import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  buildContractHarness,
  closeContractHarness,
  authenticated,
  TEST_USER,
  OTHER_USER,
  type ContractHarness,
} from '../test-helpers/contract-harness';

/**
 * Contract tests for /api/jobs at the HTTP boundary. Besides the usual
 * validation and scoping pins, these lock the AI-failure mapping: a failing
 * AI call in analyzeJobMatch / batchMatchJobs becomes 502 Bad Gateway with a
 * stable client-safe message, while service-level 404s keep their status.
 */
describe('JobsController contract (HTTP boundary)', () => {
  let h: ContractHarness;

  beforeEach(async () => {
    h = await buildContractHarness({
      job: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
      resume: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      savedSearch: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    });
  });

  afterEach(async () => {
    await closeContractHarness(h);
  });

  describe('userId scoping', () => {
    it('passes the authenticated user to job reads and never trusts params', async () => {
      h.prisma.job.findFirst.mockResolvedValue({ id: 'j1', userId: TEST_USER });

      const res = await authenticated(h.app.getHttpServer() as any)
        .get('/jobs/j1');

      expect(res.status).toBe(200);
      expect(h.prisma.job.findFirst).toHaveBeenCalledWith({ where: { id: 'j1', userId: TEST_USER } });
    });

    it('uses a different user id per request header', async () => {
      await authenticated(h.app.getHttpServer() as any, OTHER_USER).get('/jobs/j1');

      expect(h.prisma.job.findFirst).toHaveBeenLastCalledWith({ where: { id: 'j1', userId: OTHER_USER } });
    });

    it('404 for a job owned by someone else', async () => {
      h.prisma.job.findFirst.mockResolvedValue(null);

      const res = await authenticated(h.app.getHttpServer() as any)
        .get('/jobs/someone-elses-job');

      expect(res.status).toBe(404);
    });

    it('scopes list filters and bookmarks to the authenticated user', async () => {
      await authenticated(h.app.getHttpServer() as any, OTHER_USER).get('/jobs?search=engineer');
      await authenticated(h.app.getHttpServer() as any, OTHER_USER)
        .post('/jobs/bookmarked')
        .send({ ids: ['a', 'b'] });

      const listWhere = h.prisma.job.findMany.mock.calls[0][0].where;
      expect(listWhere.userId).toBe(OTHER_USER);
      const bookmarkWhere = h.prisma.job.findMany.mock.calls[1][0].where;
      expect(bookmarkWhere.userId).toBe(OTHER_USER);
    });
  });

  describe('AI-failure-to-502 mapping', () => {
    it('analyzeJobMatch: upstream AI outage becomes 502 with a client-safe message', async () => {
      h.prisma.job.findFirst.mockResolvedValue({ id: 'j1', userId: TEST_USER, title: 'Engineer', description: '', requirements: '' });
      h.prisma.resume.findFirst.mockResolvedValue({ id: 'r1', userId: TEST_USER, textContent: 'x', feedback: {} });
      h.ai.chat.mockRejectedValue(new Error('OpenAI API error (503): overloaded'));

      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/jobs/j1/match')
        .send({ resumeId: 'r1' });

      expect(res.status).toBe(502);
      expect(res.body.message).toBe('AI analysis is temporarily unavailable. Please try again later.');
      // The raw upstream error must not leak to the client
      expect(JSON.stringify(res.body)).not.toContain('overloaded');
    });

    it('analyzeJobMatch: unparseable AI output becomes 502 as well', async () => {
      h.prisma.job.findFirst.mockResolvedValue({ id: 'j1', userId: TEST_USER, title: 'Engineer', description: '', requirements: '' });
      h.prisma.resume.findFirst.mockResolvedValue({ id: 'r1', userId: TEST_USER, textContent: 'x', feedback: {} });
      h.ai.chat.mockResolvedValue({ message: { role: 'assistant', content: 'not json at all' } });
      h.ai.getResponseText.mockReturnValue('not json at all');
      h.ai.parseAIResponse.mockImplementation(() => {
        throw new Error('Failed to parse AI response as JSON. Preview: not json');
      });

      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/jobs/j1/match')
        .send({ resumeId: 'r1' });

      expect(res.status).toBe(502);
      expect(JSON.stringify(res.body)).not.toContain('Preview');
    });

    it('batchMatchJobs: AI failure becomes 502', async () => {
      h.prisma.job.findMany.mockResolvedValue([
        { id: 'j1', title: 'A', companyName: 'C', description: '', requirements: '' },
      ]);
      h.prisma.resume.findFirst.mockResolvedValue({ id: 'r1', userId: TEST_USER, textContent: 'x', feedback: {} });
      h.ai.chat.mockRejectedValue(new Error('timeout'));

      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/jobs/batch-match')
        .send({ jobIds: ['j1'], resumeId: 'r1' });

      expect(res.status).toBe(502);
    });

    it('service-level 404 keeps its status even when the AI never runs', async () => {
      h.prisma.job.findFirst.mockResolvedValue(null);
      h.ai.chat.mockRejectedValue(new Error('AI exploded'));

      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/jobs/missing/match')
        .send({ resumeId: 'r1' });

      expect(res.status).toBe(404);
      expect(h.ai.chat).not.toHaveBeenCalled();
    });

    it('the happy path still returns the parsed AI result', async () => {
      h.prisma.job.findFirst.mockResolvedValue({ id: 'j1', userId: TEST_USER, title: 'Engineer', description: '', requirements: '' });
      h.prisma.resume.findFirst.mockResolvedValue({ id: 'r1', userId: TEST_USER, textContent: 'x', feedback: {} });
      h.ai.chat.mockResolvedValue({ message: { role: 'assistant', content: '{"matchPercentage": 82}' } });
      h.ai.getResponseText.mockReturnValue('{"matchPercentage": 82}');
      h.ai.parseAIResponse.mockReturnValue({ matchPercentage: 82 });

      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/jobs/j1/match')
        .send({ resumeId: 'r1' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ matchPercentage: 82 });
    });
  });

  describe('search contract', () => {
    it('missing JSEARCH_API_KEY surfaces as 502 through the controller', async () => {
      await closeContractHarness(h);
      h = await buildContractHarness(
        { job: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) } },
        { jsearchApiKey: null },
      );

      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/jobs/search')
        .send({ keywords: ['node'] });

      expect(res.status).toBe(502);
      expect(JSON.stringify(res.body)).toContain('JSEARCH_API_KEY');
    });

    it('rate limit breach surfaces as 429 through the controller', async () => {
      await closeContractHarness(h);
      h = await buildContractHarness(
        { job: { deleteMany: vi.fn() } },
        { redisOverrides: { incrementRateLimit: vi.fn().mockResolvedValue(11) } },
      );

      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/jobs/search')
        .send({ keywords: ['node'] });

      expect(res.status).toBe(429);
    });

    it('single-string keywords from the client are normalized before the upstream call', async () => {
      const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: { jobs: [] } }));
      vi.stubGlobal('fetch', fetchMock);
      try {
        const res = await authenticated(h.app.getHttpServer() as any)
          .post('/jobs/search')
          .send({ keywords: 'react developer' });

        expect(res.status).toBe(201);
        expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain('query=react developer');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
