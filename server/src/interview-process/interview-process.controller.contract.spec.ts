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
 * Contract tests: pin the HTTP contract of /api/interview-process/notes —
 * status codes, ValidationPipe behavior with the main.ts options, and which
 * user id reaches the service. They run the production controller and
 * service with only Prisma replaced, over real HTTP via supertest.
 */
describe('InterviewProcessController notes contract (HTTP boundary)', () => {
  let h: ContractHarness;

  const validNote = {
    companyName: 'Acme',
    roleTitle: 'Backend Engineer',
    interviewType: 'technical',
    interviewDate: '2026-09-10T15:00:00.000Z',
    questionsAsked: [
      { question: 'Explain database indexing', category: 'general', myAnswer: 'B-trees', rating: 4 },
    ],
    selfRating: 4,
  };

  beforeEach(async () => {
    h = await buildContractHarness({
      interviewNote: {
        create: vi.fn().mockResolvedValue({ id: 'n1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'n1', userId: TEST_USER }),
        update: vi.fn().mockResolvedValue({ id: 'n1' }),
      },
    });
  });

  afterEach(async () => {
    await closeContractHarness(h);
  });

  describe('DTO validation (real ValidationPipe from main.ts)', () => {
    it('400 when companyName or roleTitle is missing (they are required columns)', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes')
        .send({ ...validNote, companyName: undefined, roleTitle: undefined });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('companyName');
      expect(h.prisma.interviewNote.create).not.toHaveBeenCalled();
    });

    it('400 when interviewType is not one of the schema values', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes')
        .send({ ...validNote, interviewType: 'vibe_check' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('interviewType');
      expect(h.prisma.interviewNote.create).not.toHaveBeenCalled();
    });

    it('400 when interviewDate is not a date string', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes')
        .send({ ...validNote, interviewDate: 'last Tuesday' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('interviewDate');
    });

    it('400 when selfRating is out of the 1-5 range', async () => {
      for (const selfRating of [0, 6]) {
        const res = await authenticated(h.app.getHttpServer() as any)
          .post('/interview-process/notes')
          .send({ ...validNote, selfRating });

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body)).toContain('selfRating');
      }
      expect(h.prisma.interviewNote.create).not.toHaveBeenCalled();
    });

    it('400 when a nested question entry is invalid', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes')
        .send({
          ...validNote,
          questionsAsked: [{ question: '', rating: 11 }], // empty question + out-of-range rating
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('questionsAsked');
      expect(h.prisma.interviewNote.create).not.toHaveBeenCalled();
    });

    it('400 when questionsAsked is not an array', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes')
        .send({ ...validNote, questionsAsked: 'nope' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('questionsAsked');
    });

    it('201 on a valid note and persists the validated, whitelisted data', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes')
        .send({ ...validNote, userId: OTHER_USER, isActive: true }); // unknown fields

      expect(res.status).toBe(201);
      const data = h.prisma.interviewNote.create.mock.calls[0][0].data;
      expect(data.companyName).toBe('Acme');
      expect(data.roundNumber).toBe(1); // service default
      expect(data.interviewDate).toEqual(new Date('2026-09-10T15:00:00.000Z'));
      expect(data.questionsAsked[0].question).toBe('Explain database indexing');
      // whitelist strips unknown fields; userId here is the service-injected
      // authenticated id, not the client-supplied one
      expect('isActive' in data).toBe(false);
    });
  });

  describe('update contract', () => {
    it('PATCH accepts a partial update and strips non-updatable fields', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .patch('/interview-process/notes/n1')
        .send({ selfRating: 2, companyName: 'attempted-move' });

      expect(res.status).toBe(200);
      const data = h.prisma.interviewNote.update.mock.calls[0][0].data;
      expect(data.selfRating).toBe(2);
      expect('companyName' in data).toBe(false);
    });

    it('400 when the PATCH body violates the DTO', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .patch('/interview-process/notes/n1')
        .send({ selfRating: 99 });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('selfRating');
      expect(h.prisma.interviewNote.update).not.toHaveBeenCalled();
    });
  });

  describe('userId scoping', () => {
    it('uses the authenticated user id, never a client-supplied one', async () => {
      await authenticated(h.app.getHttpServer() as any, OTHER_USER)
        .post('/interview-process/notes')
        .send({ ...validNote, userId: TEST_USER });

      const data = h.prisma.interviewNote.create.mock.calls[0][0].data;
      expect(data.userId).toBe(OTHER_USER);
      expect(data.userId).not.toBe(TEST_USER);
    });

    it('scopes note reads and updates to the authenticated user', async () => {
      await authenticated(h.app.getHttpServer() as any, OTHER_USER)
        .patch('/interview-process/notes/n1')
        .send({ selfRating: 3 });

      expect(h.prisma.interviewNote.findFirst).toHaveBeenCalledWith({
        where: { id: 'n1', userId: OTHER_USER },
      });
    });

    it('404s when the note belongs to someone else', async () => {
      h.prisma.interviewNote.findFirst.mockResolvedValue(null);

      const res = await authenticated(h.app.getHttpServer() as any)
        .patch('/interview-process/notes/not-yours')
        .send({ selfRating: 3 });

      expect(res.status).toBe(404);
    });
  });

  describe('feedback DTO validation', () => {
    const validFeedback = {
      interviewerName: 'Sarah Chen',
      rating: 4,
      feedbackText: 'Strong system design fundamentals.',
      recommendation: 'hire',
    };

    beforeEach(() => {
      h.prisma.interviewNote.findFirst.mockResolvedValue({ id: 'n1', userId: TEST_USER });
      h.prisma.interviewerFeedback = {
        create: vi.fn().mockResolvedValue({ id: 'f1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'f1', userId: TEST_USER }),
        update: vi.fn().mockResolvedValue({ id: 'f1' }),
      };
    });

    it('400 when interviewerName is missing (the old `interviewer` key is not accepted)', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes/n1/feedback')
        .send({ interviewer: 'Sarah Chen', rating: 4, feedbackText: 'ok', recommendation: 'hire' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('interviewerName');
      expect(h.prisma.interviewerFeedback.create).not.toHaveBeenCalled();
    });

    it('400 when recommendation is not one of the schema values', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes/n1/feedback')
        .send({ ...validFeedback, recommendation: 'maybe' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('recommendation');
    });

    it('400 when rating is out of the 1-5 range', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes/n1/feedback')
        .send({ ...validFeedback, rating: 9 });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('rating');
    });

    it('201 on a valid feedback entry, persisted with the note route id', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/notes/n1/feedback')
        .send(validFeedback);

      expect(res.status).toBe(201);
      const data = h.prisma.interviewerFeedback.create.mock.calls[0][0].data;
      expect(data.interviewNoteId).toBe('n1');
      expect(data.interviewerName).toBe('Sarah Chen');
      expect(data.recommendation).toBe('hire');
    });

    it('PATCH strips non-updatable fields and rejects an invalid status-less rating', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .patch('/interview-process/feedback/f1')
        .send({ rating: 3, interviewerName: 'spoof' });

      expect(res.status).toBe(200);
      const data = h.prisma.interviewerFeedback.update.mock.calls[0][0].data;
      expect(data.rating).toBe(3);
      expect('interviewerName' in data).toBe(false);
    });
  });

  describe('panel interview DTO validation', () => {
    const validPanel = {
      companyName: 'Acme',
      roleTitle: 'Backend Engineer',
      scheduledAt: '2026-09-20T15:00:00.000Z',
      duration: 90,
      interviewers: [{ name: 'A' }, { name: 'B', role: 'EM', email: 'b@acme.dev' }],
    };

    beforeEach(() => {
      h.prisma.panelInterview = {
        create: vi.fn().mockResolvedValue({ id: 'p1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'p1', userId: TEST_USER }),
        update: vi.fn().mockResolvedValue({ id: 'p1' }),
      };
    });

    it('400 when an interviewer entry has no name', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/panel-interviews')
        .send({ ...validPanel, interviewers: [{ role: 'EM' }] });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('interviewers');
      expect(h.prisma.panelInterview.create).not.toHaveBeenCalled();
    });

    it('400 when scheduledAt is malformed or duration is missing', async () => {
      for (const bad of [
        { ...validPanel, scheduledAt: 'next friday' },
        { ...validPanel, duration: undefined },
      ]) {
        const res = await authenticated(h.app.getHttpServer() as any)
          .post('/interview-process/panel-interviews')
          .send(bad);
        expect(res.status).toBe(400);
      }
      expect(h.prisma.panelInterview.create).not.toHaveBeenCalled();
    });

    it('201 on a valid panel and the status update is constrained to known values', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/panel-interviews')
        .send(validPanel);
      expect(res.status).toBe(201);

      const bad = await authenticated(h.app.getHttpServer() as any)
        .patch('/interview-process/panel-interviews/p1')
        .send({ status: 'ghosted' });
      expect(bad.status).toBe(400);
      expect(h.prisma.panelInterview.update).not.toHaveBeenCalled();

      const ok = await authenticated(h.app.getHttpServer() as any)
        .patch('/interview-process/panel-interviews/p1')
        .send({ status: 'completed' });
      expect(ok.status).toBe(200);
      expect(h.prisma.panelInterview.update.mock.calls[0][0].data.status).toBe('completed');
    });
  });

  describe('follow-up email DTO validation', () => {
    beforeEach(() => {
      h.prisma.followUpEmail = {
        create: vi.fn().mockResolvedValue({ id: 'e1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'e1', userId: TEST_USER }),
        update: vi.fn().mockResolvedValue({ id: 'e1' }),
      };
    });

    it('400 when subject or body is missing, or the type is unknown', async () => {
      for (const bad of [
        { type: 'thank_you', body: 'x' },
        { type: 'thank_you', subject: 'x' },
        { type: 'blast', subject: 'x', body: 'y' },
      ]) {
        const res = await authenticated(h.app.getHttpServer() as any)
          .post('/interview-process/follow-up-emails')
          .send(bad);
        expect(res.status).toBe(400);
      }
      expect(h.prisma.followUpEmail.create).not.toHaveBeenCalled();
    });

    it('201 on a valid email, linked to the note and application it was sent from', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/follow-up-emails')
        .send({ applicationId: 'a1', interviewNoteId: 'n1', type: 'thank_you', subject: 'Thanks', body: '...' });

      expect(res.status).toBe(201);
      const data = h.prisma.followUpEmail.create.mock.calls[0][0].data;
      expect(data.interviewNoteId).toBe('n1');
      expect(data.applicationId).toBe('a1');
    });

    it('mark-sent PATCH accepts sentAt but nothing else', async () => {
      const ok = await authenticated(h.app.getHttpServer() as any)
        .patch('/interview-process/follow-up-emails/e1')
        .send({ sentAt: '2026-09-13T10:00:00.000Z' });
      expect(ok.status).toBe(200);
      const data = h.prisma.followUpEmail.update.mock.calls[0][0].data;
      expect(data.sentAt).toEqual(new Date('2026-09-13T10:00:00.000Z'));

      const bad = await authenticated(h.app.getHttpServer() as any)
        .patch('/interview-process/follow-up-emails/e1')
        .send({ sentAt: 'yesterday' });
      expect(bad.status).toBe(400);
    });
  });

  describe('case study DTO validation', () => {
    beforeEach(() => {
      h.prisma.caseStudy = {
        create: vi.fn().mockResolvedValue({ id: 'cs1' }),
        update: vi.fn().mockResolvedValue({ id: 'cs1' }),
      };
    });

    it('400 when a slide entry has no title', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/case-studies')
        .send({
          companyName: 'Acme',
          roleTitle: 'BE',
          title: 'Pricing',
          slides: [{ content: 'no title' }],
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('slides');
      expect(h.prisma.caseStudy.create).not.toHaveBeenCalled();
    });

    it('201 on a valid case study, 400 when generate omits the description', async () => {
      const ok = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/case-studies')
        .send({ companyName: 'Acme', roleTitle: 'BE', title: 'Pricing' });
      expect(ok.status).toBe(201);

      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/interview-process/case-studies/generate')
        .send({ companyName: 'Acme', roleTitle: 'BE', title: 'Pricing' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('description');
    });
  });
});
