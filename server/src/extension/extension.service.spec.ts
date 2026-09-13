import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExtensionService } from './extension.service';
import { makeLoggerSilent, makePrismaMock } from '../test-helpers/service-mocks';

function makeService(prisma: any = {}) {
  const svc = new ExtensionService(makePrismaMock(prisma) as any);
  makeLoggerSilent(svc as any);
  return svc;
}

const profileText = JSON.stringify({
  headline: 'Full-stack Engineer',
  summary: 'Ships products.',
  skills: ['TypeScript', 'React'],
  phone: '555-0100',
  location: 'Berlin',
  linkedin: 'https://linkedin.com/in/jane',
});

describe('ExtensionService.getUserProfile', () => {
  it('prefers a parsed JSON profile from the latest resume', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1',
          name: 'Jane Doe',
          email: 'jane@x.dev',
          updatedAt: new Date('2026-09-01T00:00:00.000Z'),
          resumes: [{ textContent: profileText }],
        }),
      },
    };
    const svc = makeService(prisma);

    const profile = await svc.getUserProfile('u1');

    expect(profile).toMatchObject({
      id: 'u1',
      userId: 'u1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@x.dev',
      headline: 'Full-stack Engineer',
      phone: '555-0100',
      location: 'Berlin',
      linkedinUrl: 'https://linkedin.com/in/jane',
      skills: ['TypeScript', 'React'],
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
  });

  it('falls back to keyword extraction when the resume text is not JSON', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1',
          name: 'Sam',
          email: 'sam@x.dev',
          updatedAt: new Date(),
          resumes: [
            { textContent: 'Engineer with TypeScript and Docker experience in Berlin' },
          ],
        }),
      },
    };
    const svc = makeService(prisma);

    const profile = await svc.getUserProfile('u1');

    expect(profile.headline).toBe('');
    expect(profile.summary).toContain('TypeScript');
    expect(profile.skills).toEqual(expect.arrayContaining(['TypeScript', 'Docker']));
  });

  it('returns empty profile data for a user with no resumes', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1',
          name: 'Jane Doe',
          email: 'jane@x.dev',
          updatedAt: new Date(),
          resumes: [],
        }),
      },
    };
    const svc = makeService(prisma);

    const profile = await svc.getUserProfile('u1');

    expect(profile.skills).toEqual([]);
    expect(profile.experience).toEqual([]);
    expect(profile.headline).toBe('');
  });

  it('throws NotFound for an unknown user', async () => {
    const svc = makeService({ user: { findUnique: vi.fn().mockResolvedValue(null) } });

    await expect(svc.getUserProfile('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ExtensionService.application bundles', () => {
  it('createApplicationBundle stores a draft with normalized nulls', async () => {
    const prisma = {
      jobApplication: { create: vi.fn().mockResolvedValue({ id: 'b1', status: 'draft' }) },
    };
    const svc = makeService(prisma);

    const bundle = await svc.createApplicationBundle('u1', {
      companyName: 'Acme',
      roleTitle: 'SWE',
    });

    expect(bundle.status).toBe('draft');
    expect(prisma.jobApplication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        companyName: 'Acme',
        roleTitle: 'SWE',
        jobId: null,
        resumeId: null,
        status: 'draft',
      }),
    });
  });

  it('update/delete reject bundles owned by someone else', async () => {
    const prisma = {
      jobApplication: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const svc = makeService(prisma);

    await expect(
      svc.updateApplicationBundle('u1', 'b1', { status: 'applied' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.deleteApplicationBundle('u1', 'b1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update keeps the existing status when none is provided', async () => {
    const prisma = {
      jobApplication: {
        findFirst: vi.fn().mockResolvedValue({ id: 'b1', status: 'phone_screen' }),
        update: vi.fn().mockResolvedValue({ id: 'b1' }),
      },
    };
    const svc = makeService(prisma);

    await svc.updateApplicationBundle('u1', 'b1', { notes: 'recruiter call went well' });

    expect(prisma.jobApplication.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { notes: 'recruiter call went well', status: 'phone_screen' },
    });
  });

  it('addCommunicationLog and upsertReferral check ownership first', async () => {
    const prisma = {
      jobApplication: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const svc = makeService(prisma);

    await expect(
      svc.addCommunicationLog('u1', { applicationId: 'b1', type: 'email', content: 'hi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      svc.upsertReferral('u1', { applicationId: 'b1', employeeName: 'Ref' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Ownership checks are scoped to the user
    expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({
      where: { id: 'b1', userId: 'u1' },
    });
  });

  it('addCommunicationLog defaults occurredAt to now and parses provided dates', async () => {
    const prisma = {
      jobApplication: {
        findFirst: vi.fn().mockResolvedValue({ id: 'b1' }),
      },
      communicationLog: { create: vi.fn().mockResolvedValue({ id: 'c1' }) },
    };
    const svc = makeService(prisma);

    await svc.addCommunicationLog('u1', {
      applicationId: 'b1',
      type: 'email',
      content: 'hi',
      occurredAt: '2026-09-01T10:00:00.000Z',
    });
    expect(prisma.communicationLog.create.mock.calls[0][0].data.occurredAt).toEqual(
      new Date('2026-09-01T10:00:00.000Z'),
    );

    await svc.addCommunicationLog('u1', { applicationId: 'b1', type: 'call', content: 'hello' });
    expect(prisma.communicationLog.create.mock.calls[1][0].data.occurredAt).toBeInstanceOf(Date);
  });
});

describe('ExtensionService.authenticateExtensionUser', () => {
  it('returns a token for a known email and rejects unknown ones', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'jane@x.dev' }),
      },
    };
    const svc = makeService(prisma);

    const auth = await svc.authenticateExtensionUser('jane@x.dev', 'hunter2');

    expect(auth.userId).toBe('u1');
    expect(Buffer.from(auth.accessToken, 'base64').toString()).toContain('u1:');

    (prisma.user.findUnique as any).mockResolvedValue(null);
    await expect(svc.authenticateExtensionUser('evil@x.dev', 'x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('ExtensionService.getApplicationAnalytics', () => {
  it('aggregates statuses and conversion rates', async () => {
    const apps = [
      { status: 'applied' },
      { status: 'applied' },
      { status: 'phone_screen' },
      { status: 'interviewing' },
      { status: 'offer' },
      { status: 'accepted' },
      { status: 'rejected' },
      { status: 'withdrawn' },
      { status: 'draft' },
      { status: 'draft' },
    ];
    const prisma = {
      jobApplication: { findMany: vi.fn().mockResolvedValue(apps) },
    };
    const svc = makeService(prisma);

    const analytics = await svc.getApplicationAnalytics('u1');

    expect(analytics.total).toBe(10);
    expect(analytics.byStatus).toEqual({
      applied: 2,
      phone_screen: 1,
      interviewing: 1,
      offer: 1,
      accepted: 1,
      rejected: 1,
      withdrawn: 1,
      draft: 2,
    });
    expect(analytics.conversionRates).toEqual({
      appliedToScreen: '50.0%', // 1 phone screen / 2 applied
      screenToInterview: '100.0%',
      interviewToOffer: '100.0%',
      appliedToOffer: '50.0%', // 1 offer / 2 applied
      overallSuccess: '10.0%', // 1 accepted / 10 total
    });
  });

  it('returns 0% rates when there are no applications', async () => {
    const svc = makeService({
      jobApplication: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const analytics = await svc.getApplicationAnalytics('u1');

    expect(analytics.total).toBe(0);
    expect(analytics.conversionRates.overallSuccess).toBe('0%');
  });

  it('passes date filters through as Date objects', async () => {
    const prisma = {
      jobApplication: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const svc = makeService(prisma);

    await svc.getApplicationAnalytics('u1', { startDate: '2026-08-01', endDate: '2026-08-31' });

    const where = prisma.jobApplication.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
    expect(where.createdAt.gte).toEqual(new Date('2026-08-01'));
    expect(where.createdAt.lte).toEqual(new Date('2026-08-31'));
  });
});
