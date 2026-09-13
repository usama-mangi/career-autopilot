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
 * Contract tests: these pin the HTTP contract of /api/extension — status
 * codes, ValidationPipe behavior with main.ts options, and which user id
 * reaches the service. They run the production controller and service with
 * only Prisma replaced, over real HTTP via supertest.
 */
describe('ExtensionController contract (HTTP boundary)', () => {
  let h: ContractHarness;

  beforeEach(async () => {
    h = await buildContractHarness({
      jobApplication: {
        create: vi.fn().mockResolvedValue({ id: 'b1', status: 'draft' }),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 'b1' }),
      },
    });
  });

  afterEach(async () => {
    await closeContractHarness(h);
  });

  describe('DTO validation (real ValidationPipe from main.ts)', () => {
    it('400 with the offending field when a comms log has an invalid type', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/extension/applications/b1/comms')
        .send({ type: 'smoke_signal', content: 'hello' });

      expect(res.status).toBe(400);
      const message = JSON.stringify(res.body);
      expect(message).toContain('type');
      // The service must never see the invalid body
      expect(h.prisma.jobApplication.findFirst).not.toHaveBeenCalled();
    });

    it('400 when required fields are missing on a comms log', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/extension/applications/b1/comms')
        .send({ type: 'email' }); // content missing

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('content');
    });

    it('400 when occurredAt is not a date string', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/extension/applications/b1/comms')
        .send({ type: 'email', content: 'hi', occurredAt: 'not-a-date' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('occurredAt');
    });

    it('400 when a referral has an invalid status', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/extension/applications/b1/referral')
        .send({ employeeName: 'Ref', status: 'ghosted' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('status');
    });

    it('accepts a valid comms log and injects applicationId from the route', async () => {
      h.prisma.jobApplication.findFirst.mockResolvedValue({ id: 'b1', userId: TEST_USER });
      h.prisma.communicationLog = { create: vi.fn().mockResolvedValue({ id: 'c1' }) };

      const res = await authenticated(h.app.getHttpServer() as any)
        .post('/extension/applications/b1/comms')
        .send({ type: 'email', content: 'Recruiter replied', occurredAt: '2026-09-01T10:00:00.000Z' });

      expect(res.status).toBe(201);
      const data = h.prisma.communicationLog.create.mock.calls[0][0].data;
      expect(data.applicationId).toBe('b1');
      expect(data.occurredAt).toEqual(new Date('2026-09-01T10:00:00.000Z'));
    });

    it('strips unknown fields (whitelist) so users cannot mass-assign', async () => {
      h.prisma.jobApplication.findFirst.mockResolvedValue({ id: 'b1', userId: TEST_USER, status: 'draft' });

      const res = await authenticated(h.app.getHttpServer() as any)
        .patch('/extension/applications/b1')
        .send({
          notes: 'legit update',
          userId: OTHER_USER, // not in the DTO — must be stripped
          companyId: 'hacked', // not in the DTO — must be stripped
        });

      expect(res.status).toBe(200);
      const data = h.prisma.jobApplication.update.mock.calls[0][0].data;
      expect(data.notes).toBe('legit update');
      expect('userId' in data).toBe(false);
      expect('companyId' in data).toBe(false);
    });

    it('400 when the analytics date filters are malformed', async () => {
      const res = await authenticated(h.app.getHttpServer() as any)
        .get('/extension/applications/analytics')
        .query({ startDate: '09/01/2026', endDate: 'yesterday' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('startDate');
    });
  });

  describe('userId scoping', () => {
    it('uses the authenticated user id, never a client-supplied one', async () => {
      h.prisma.jobApplication.create.mockResolvedValue({ id: 'b2', status: 'draft' });

      const res = await authenticated(h.app.getHttpServer() as any, OTHER_USER)
        .post('/extension/applications')
        .send({ companyName: 'Acme', roleTitle: 'SWE', userId: TEST_USER });

      expect(res.status).toBe(201);
      const data = h.prisma.jobApplication.create.mock.calls[0][0].data;
      expect(data.userId).toBe(OTHER_USER);
      expect(data.userId).not.toBe(TEST_USER);
    });

    it('scopes bundle reads and updates to the authenticated user', async () => {
      await authenticated(h.app.getHttpServer() as any, OTHER_USER)
        .get('/extension/applications/b1');
      await authenticated(h.app.getHttpServer() as any, OTHER_USER)
        .patch('/extension/applications/b1')
        .send({ notes: 'x' });

      expect(h.prisma.jobApplication.findFirst).toHaveBeenCalledWith({
        where: { id: 'b1', userId: OTHER_USER },
      });
    });

    it('returns 404 (not the data) when the bundle belongs to someone else', async () => {
      h.prisma.jobApplication.findFirst.mockResolvedValue(null);

      const res = await authenticated(h.app.getHttpServer() as any)
        .get('/extension/applications/belongs-to-someone-else');

      expect(res.status).toBe(404);
    });

    it('scopes the profile endpoint to the authenticated user', async () => {
      h.prisma.user = {
        findUnique: vi.fn().mockResolvedValue({
          id: OTHER_USER,
          name: 'Other User',
          email: 'o@x.dev',
          updatedAt: new Date(),
          resumes: [],
        }),
      };

      await authenticated(h.app.getHttpServer() as any, OTHER_USER)
        .get('/extension/profile');

      expect(h.prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: OTHER_USER } }),
      );
    });
  });
});
