import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DeadlinesService } from './deadlines.service';
import { makeLoggerSilent, makePrismaMock, makeRedisMock } from '../test-helpers/service-mocks';

beforeEach(() => {
  // Calendar windows are computed in local time; pin the clock and zone.
  process.env.TZ = 'UTC';
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-13T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

function makeService(prisma: any = {}, redis?: any) {
  const svc = new DeadlinesService(
    makePrismaMock(prisma) as any,
    (redis ?? makeRedisMock({ delPattern: vi.fn().mockResolvedValue(undefined) })) as any,
  );
  makeLoggerSilent(svc as any);
  return svc;
}

function deadlineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    userId: 'u1',
    jobId: null,
    roleTitle: 'Backend Engineer',
    companyName: 'Acme',
    deadline: new Date('2026-09-20T09:00:00.000Z'),
    reminderAt: null,
    reminderSent: false,
    status: 'upcoming',
    notes: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    job: null,
    ...overrides,
  };
}

describe('DeadlinesService.crud scoping', () => {
  it('createDeadline pulls the title from the linked job when one exists', async () => {
    const prisma = {
      job: { findFirst: vi.fn().mockResolvedValue({ title: 'Senior SWE', companyName: 'Acme' }) },
      applicationDeadline: { create: vi.fn().mockResolvedValue(deadlineRow()) },
    };
    const redis = makeRedisMock() as any;
    const svc = makeService(prisma, redis);

    const created = await svc.createDeadline('u1', {
      jobId: 'j1',
      companyName: 'Acme',
      roleTitle: 'Whatever the user typed',
      deadline: new Date('2026-09-20T09:00:00.000Z'),
    });

    expect(prisma.job.findFirst).toHaveBeenCalledWith({
      where: { id: 'j1', userId: 'u1' },
      select: { title: true, companyName: true },
    });
    expect(prisma.applicationDeadline.create.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      roleTitle: 'Senior SWE',
      status: 'upcoming',
    });
    expect(created.jobTitle).toBe('Backend Engineer'); // mapped from roleTitle
    expect(redis.delPattern).toHaveBeenCalledWith('deadlines:u1:*');
  });

  it('createDeadline keeps the typed title when the job lookup misses', async () => {
    const prisma = {
      job: { findFirst: vi.fn().mockResolvedValue(null) },
      applicationDeadline: { create: vi.fn().mockResolvedValue(deadlineRow()) },
    };
    const svc = makeService(prisma);

    await svc.createDeadline('u1', {
      companyName: 'Acme',
      roleTitle: 'Backend Engineer',
      deadline: new Date('2026-09-20'),
    });

    expect(prisma.applicationDeadline.create.mock.calls[0][0].data.roleTitle).toBe('Backend Engineer');
  });

  it('updateDeadline and deleteDeadline throw NotFound for other users', async () => {
    const prisma = {
      applicationDeadline: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const svc = makeService(prisma);

    await expect(svc.updateDeadline('d1', 'u1', { notes: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.deleteDeadline('d1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.applicationDeadline.findFirst).toHaveBeenCalledWith({ where: { id: 'd1', userId: 'u1' } });
  });

  it('deleteDeadline removes the row and invalidates the cache', async () => {
    const prisma = {
      applicationDeadline: {
        findFirst: vi.fn().mockResolvedValue(deadlineRow()),
        delete: vi.fn().mockResolvedValue({}),
      },
    };
    const redis = makeRedisMock() as any;
    const svc = makeService(prisma, redis);

    await svc.deleteDeadline('d1', 'u1');

    expect(prisma.applicationDeadline.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    expect(redis.delPattern).toHaveBeenCalledWith('deadlines:u1:*');
  });

  it('getDeadlineById throws NotFound when the row is missing', async () => {
    const svc = makeService({ applicationDeadline: { findFirst: vi.fn().mockResolvedValue(null) } });

    await expect(svc.getDeadlineById('d1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mapDeadline prefers roleTitle over the joined job title', async () => {
    const svc = makeService({
      applicationDeadline: {
        findFirst: vi.fn().mockResolvedValue(
          deadlineRow({ roleTitle: 'From Row', job: { id: 'j1', title: 'From Job', companyName: 'Acme' } }),
        ),
      },
    });

    const d = await svc.getDeadlineById('d1', 'u1');

    expect(d.jobTitle).toBe('From Row');
  });
});

describe('DeadlinesService.calendar and windows', () => {
  it('getCalendarView buckets deadlines by day and covers every day of the month', async () => {
    const rows = [
      deadlineRow({ id: 'a', deadline: new Date('2026-09-05T10:00:00.000Z') }),
      deadlineRow({ id: 'b', deadline: new Date('2026-09-05T18:00:00.000Z') }),
      deadlineRow({ id: 'c', deadline: new Date('2026-09-20T09:00:00.000Z') }),
    ];
    const prisma = {
      applicationDeadline: {
        findMany: vi.fn().mockImplementation(async ({ where }: any) =>
          rows.filter((r) => {
            const dl = r.deadline as Date;
            const gte = where.deadline?.gte ? dl >= where.deadline.gte : true;
            const lte = where.deadline?.lte ? dl <= where.deadline.lte : true;
            return gte && lte;
          }),
        ),
      },
    };
    const svc = makeService(prisma);

    const view = await svc.getCalendarView('u1', 2026, 8); // September, 0-indexed

    expect(view.month).toBe(8);
    expect(view.year).toBe(2026);
    expect(view.deadlines).toHaveLength(30); // September has 30 days

    const sep5 = view.deadlines[4];
    expect(sep5.date.getUTCDate()).toBe(5);
    expect(sep5.items.map((i) => i.id)).toEqual(['a', 'b']);

    const sep20 = view.deadlines[19];
    expect(sep20.items.map((i) => i.id)).toEqual(['c']);

    // A day with nothing on it
    expect(view.deadlines[0].items).toEqual([]);

    // Window sent to the DB covers the whole month
    const where = prisma.applicationDeadline.findMany.mock.calls[0][0].where;
    expect(where.deadline.gte).toEqual(new Date(2026, 8, 1));
    expect(where.deadline.lte).toEqual(new Date(2026, 9, 0, 23, 59, 59));
  });

  it('getUpcomingReminders filters to upcoming status within the window', async () => {
    const prisma = {
      applicationDeadline: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const svc = makeService(prisma);

    await svc.getUpcomingReminders('u1', 7);

    const where = prisma.applicationDeadline.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
    expect(where.status).toBe('upcoming');
    expect(where.deadline.gte).toEqual(new Date('2026-09-13T12:00:00.000Z'));
    expect(where.deadline.lte).toEqual(new Date('2026-09-20T12:00:00.000Z'));
  });

  it('getOverdueDeadlines selects upcoming-status rows that are already past', async () => {
    const prisma = {
      applicationDeadline: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const svc = makeService(prisma);

    await svc.getOverdueDeadlines('u1');

    const where = prisma.applicationDeadline.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('upcoming');
    expect(where.deadline.lte).toEqual(new Date('2026-09-13T12:00:00.000Z'));
  });

  it('getDeadlineStats runs the five counts', async () => {
    const counts = [3, 1, 2, 2, 4];
    const prisma = {
      applicationDeadline: {
        count: vi.fn().mockImplementation(() => counts.shift()),
      },
    };
    const svc = makeService(prisma);

    const stats = await svc.getDeadlineStats('u1');

    expect(stats).toEqual({ upcoming: 3, overdue: 1, applied: 2, thisWeek: 2, thisMonth: 4 });
    expect(prisma.applicationDeadline.count).toHaveBeenCalledTimes(5);
    expect(prisma.applicationDeadline.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', status: 'upcoming' }) }),
    );
  });
});
