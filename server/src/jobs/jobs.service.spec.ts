import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpException, Logger, NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { errorResponse, stubFetch } from '../test-helpers/fetch-mock';
import {
  makeLoggerSilent,
  makePrismaMock,
  makeQueueMock,
  makeRedisMock,
} from '../test-helpers/service-mocks';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function jsearchJob(overrides: Record<string, unknown> = {}) {
  return {
    job_id: 'job-1',
    job_title: 'Backend Engineer',
    employer_name: 'Acme Corp',
    job_location: 'Berlin, Germany',
    job_description: 'Build APIs with node.js and postgresql.',
    job_apply_link: 'https://acme.com/careers/backend-engineer',
    job_posted_at_datetime_utc: '2026-09-01T00:00:00.000Z',
    job_posted_at_timestamp: 0,
    job_publisher: 'LinkedIn',
    ...overrides,
  };
}

function jsearchResponse(jobs: unknown[]) {
  return Response.json({ data: { jobs }, status: 'OK', request_id: 'r1' });
}

/**
 * Build JobsService with explicit mocks. Tests keep references to the prisma
 * object they pass in so they can assert on the queries the service issued.
 */
function makeService(config: Record<string, string> = {}, prisma: any = {}, redis: any = {}) {
  const svc = new JobsService(
    makePrismaMock(prisma) as any,
    { get: (key: string) => config[key] } as any,
    { chat: vi.fn(), parseAIResponse: vi.fn(), getResponseText: vi.fn() } as any,
    makeRedisMock(redis) as any,
    makeQueueMock() as any,
  );
  makeLoggerSilent(svc as any);
  return svc;
}

const baseConfig = { JSEARCH_API_KEY: 'test-key', JSEARCH_API_HOST: 'jsearch.test' };

describe('JobsService.searchJobs', () => {
  it('rate-limits after the configured number of requests', async () => {
    const svc = makeService(baseConfig, {}, { incrementRateLimit: vi.fn().mockResolvedValue(11) });

    const err = await svc.searchJobs('u1', { keywords: ['node'] }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
  });

  it('returns 502 when JSEARCH_API_KEY is missing', async () => {
    // The constructor warns about the missing key before we can silence the
    // instance logger — intercept the prototype method instead.
    vi.spyOn(Logger.prototype as any, 'warn').mockImplementation(() => undefined);
    const fetchMock = stubFetch(() => Response.json({}));
    const svc = makeService({}, { job: { deleteMany: vi.fn() } });

    const err = await svc.searchJobs('u1', {}).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searches JSearch, normalizes and saves jobs', async () => {
    const created: any[] = [];
    const fetchMock = stubFetch(() => jsearchResponse([jsearchJob()]));
    const svc = makeService(baseConfig, {
      job: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          created.push(data);
          return { id: 'db-1', ...data };
        }),
      },
    });

    const result = await svc.searchJobs('u1', { keywords: ['backend'], location: 'Berlin' });

    // Correct upstream request: host, endpoint, encoded query, auth headers
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://jsearch.test/search-v2?');
    expect(String(url)).toContain('query=backend%20in%20Berlin');
    expect(init.headers['X-RapidAPI-Key']).toBe('test-key');
    expect(init.headers['X-RapidAPI-Host']).toBe('jsearch.test');

    // Mapped fields
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      title: 'Backend Engineer',
      companyName: 'Acme Corp',
      source: 'linkedin',
      sourceUrl: 'https://acme.com/careers/backend-engineer',
      remoteType: 'onsite',
    });
    expect(result.jobs).toHaveLength(1);
    expect(result.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  it('deduplicates jobs by sourceUrl within one response', async () => {
    stubFetch(() =>
      jsearchResponse([
        jsearchJob({ job_id: 'a' }),
        jsearchJob({ job_id: 'b', job_title: 'Backend Engineer II' }),
      ]),
    );
    const create = vi.fn().mockResolvedValue({});
    const svc = makeService(baseConfig, {
      job: { deleteMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), create },
    });

    await svc.searchJobs('u1', {});

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('splits a single-string keywords param before searching', async () => {
    const fetchMock = stubFetch(() => jsearchResponse([]));
    const svc = makeService(baseConfig, { job: { deleteMany: vi.fn() } });

    await svc.searchJobs('u1', { keywords: 'react developer' as any });

    expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain('query=react developer');
  });

  it('retries on upstream 5xx and fails with the last error', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(() => errorResponse(500));
    const svc = makeService(baseConfig, { job: { deleteMany: vi.fn() } });

    // Attach the rejection handler before advancing timers so the
    // rejection is never momentarily unhandled.
    const promise = svc.searchJobs('u1', {});
    const assertion = expect(promise).rejects.toThrow('JSearch API error: 500');
    await vi.advanceTimersByTimeAsync(3500); // backoff delays: 1s + 2s
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('gives up after exhausting 429 retries', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(() => errorResponse(429));
    const svc = makeService(baseConfig, { job: { deleteMany: vi.fn() } });

    const promise = svc.searchJobs('u1', {});
    const assertion = expect(promise).rejects.toThrow('JSearch API failed after retries');
    await vi.advanceTimersByTimeAsync(7500); // backoff delays: 1s + 2s + 4s
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('accepts the /search-v2 array shape as well as { data: { jobs } }', async () => {
    stubFetch(() => Response.json({ data: [jsearchJob()] }));
    const create = vi.fn().mockResolvedValue({ id: 'db-1' });
    const svc = makeService(baseConfig, {
      job: { deleteMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), create },
    });

    const result = await svc.searchJobs('u1', {});

    expect(result.jobs).toHaveLength(1);
  });

  it('normalizes monthly salary to yearly', async () => {
    stubFetch(() =>
      jsearchResponse([
        jsearchJob({
          job_salary_min: 5000,
          job_salary_max: 8000,
          job_salary_currency: 'EUR',
          job_salary_period: 'MONTH',
        }),
      ]),
    );
    const create = vi.fn().mockImplementation(async ({ data }: any) => data);
    const svc = makeService(baseConfig, {
      job: { deleteMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), create },
    });

    await svc.searchJobs('u1', {});

    expect(create.mock.calls[0][0].data).toMatchObject({
      salaryMin: 60_000,
      salaryMax: 96_000,
      salaryCurrency: 'EUR',
    });
  });
});

describe('JobsService.post-fetch filters (via searchJobs)', () => {
  /** Two jobs with distinct sourceUrls so dedup keeps both. */
  function makeTwoJobService() {
    stubFetch(() =>
      jsearchResponse([
        jsearchJob({
          job_id: 'senior',
          job_title: 'Senior Backend Engineer',
          job_employment_type: 'FULLTIME',
          job_is_remote: true,
          job_apply_link: 'https://acme.com/senior',
        }),
        jsearchJob({
          job_id: 'intern',
          job_title: 'Backend Intern',
          job_employment_type: 'INTERN',
          job_is_remote: false,
          job_apply_link: 'https://acme.com/intern',
        }),
      ]),
    );
    const create = vi.fn().mockImplementation(async ({ data }: any) => data);
    const svc = makeService(baseConfig, {
      job: { deleteMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), create },
    });
    return { svc, create };
  }

  it('filters by experience level keywords in the title', async () => {
    const { svc } = makeTwoJobService();

    const result = await svc.searchJobs('u1', { experienceLevels: ['senior'] });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('Senior Backend Engineer');
  });

  it('filters by job type, mapped from JSearch employment types', async () => {
    const { svc } = makeTwoJobService();

    const result = await svc.searchJobs('u1', { jobTypes: ['internship'] });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('Backend Intern');
  });

  it('filters by remote type', async () => {
    const { svc } = makeTwoJobService();

    const result = await svc.searchJobs('u1', { remoteTypes: ['remote'] });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('Senior Backend Engineer');
  });

  it('filters by source using the publisher-derived value', async () => {
    const { svc } = makeTwoJobService();

    const result = await svc.searchJobs('u1', { sources: ['linkedin'] });

    expect(result.jobs).toHaveLength(2);
  });

  it('over-fetches when filters are present', async () => {
    const fetchMock = stubFetch(() => jsearchResponse([]));
    const svc = makeService(baseConfig, { job: { deleteMany: vi.fn() } });

    await svc.searchJobs('u1', { limit: 10, sources: ['linkedin'] });

    expect(String(fetchMock.mock.calls[0][0])).toContain('results_per_page=30');
  });
});

describe('JobsService.upsertJob', () => {
  const external = {
    title: 'Backend Engineer',
    companyName: 'Acme Corp',
    location: 'Berlin',
    description: 'desc',
    source: 'linkedin',
    sourceUrl: 'https://acme.com/jobs/1',
  };

  it('updates the existing job and preserves user-set fields', async () => {
    const prisma = {
      job: {
        findFirst: vi.fn().mockResolvedValue({ id: 'db-1', isBookmarked: true }),
        update: vi.fn().mockResolvedValue({ id: 'db-1' }),
      },
    };
    const svc = makeService(baseConfig, prisma);

    await svc.upsertJob('u1', {
      ...external,
      isBookmarked: true,
      appliedAt: new Date(),
      tags: ['priority'],
    } as any);

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'db-1' },
      data: expect.objectContaining({ title: 'Backend Engineer', userId: 'u1' }),
    });
    const data = prisma.job.update.mock.calls[0][0].data;
    expect('isBookmarked' in data).toBe(false);
    expect('appliedAt' in data).toBe(false);
    expect('tags' in data).toBe(false);
  });

  it('keeps the existing sourceUrl when the new one is a Google search link', async () => {
    const prisma = {
      job: {
        findFirst: vi.fn().mockResolvedValue({ id: 'db-1', sourceUrl: 'https://acme.com/jobs/1' }),
        update: vi.fn().mockResolvedValue({ id: 'db-1' }),
      },
    };
    const svc = makeService(baseConfig, prisma);

    await svc.upsertJob('u1', { ...external, sourceUrl: 'https://google.com/search?q=job' } as any);

    expect(prisma.job.update.mock.calls[0][0].data.sourceUrl).toBe('https://acme.com/jobs/1');
  });

  it('creates a new job and replaces Google links with a synthetic id', async () => {
    const prisma = {
      job: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'db-2' }),
      },
    };
    const svc = makeService(baseConfig, prisma);

    await svc.upsertJob('u1', { ...external, sourceUrl: 'https://google.com/search?q=job' } as any);

    const data = prisma.job.create.mock.calls[0][0].data;
    expect(data.sourceUrl).toMatch(/^job-\d+-/);
    expect(data.sourceUrl).not.toContain('google.com');
    expect(data.userId).toBe('u1');
  });

  it('keeps a real sourceUrl when creating', async () => {
    const prisma = {
      job: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'db-3' }),
      },
    };
    const svc = makeService(baseConfig, prisma);

    await svc.upsertJob('u1', external as any);

    expect(prisma.job.create.mock.calls[0][0].data.sourceUrl).toBe('https://acme.com/jobs/1');
  });
});

describe('JobsService.bookmarks and tags', () => {
  it('toggleBookmark flips the stored flag', async () => {
    const prisma = {
      job: {
        findFirst: vi.fn().mockResolvedValue({ id: 'j1', isBookmarked: false }),
        update: vi.fn().mockResolvedValue({ id: 'j1', isBookmarked: true }),
      },
    };
    const svc = makeService(baseConfig, prisma);

    await svc.toggleBookmark('j1', 'u1');

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: { isBookmarked: true },
    });
  });

  it('toggleBookmark throws NotFound when the job belongs to someone else', async () => {
    const svc = makeService(baseConfig, {
      job: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(svc.toggleBookmark('j1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('addTags merges and deduplicates', async () => {
    const prisma = {
      job: {
        findFirst: vi.fn().mockResolvedValue({ id: 'j1', tags: ['remote', 'priority'] }),
        update: vi.fn().mockResolvedValue({ id: 'j1' }),
      },
    };
    const svc = makeService(baseConfig, prisma);

    await svc.addTags('j1', 'u1', ['priority', 'frontend']);

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: { tags: ['remote', 'priority', 'frontend'] },
    });
  });

  it('removeTag filters the tag out', async () => {
    const prisma = {
      job: {
        findFirst: vi.fn().mockResolvedValue({ id: 'j1', tags: ['a', 'b'] }),
        update: vi.fn().mockResolvedValue({ id: 'j1' }),
      },
    };
    const svc = makeService(baseConfig, prisma);

    await svc.removeTag('j1', 'u1', 'a');

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: { tags: ['b'] },
    });
  });
});

describe('JobsService.getJobById', () => {
  it('scopes the lookup by user', async () => {
    const prisma = {
      job: { findFirst: vi.fn().mockResolvedValue({ id: 'j1', userId: 'u1' }) },
    };
    const svc = makeService(baseConfig, prisma);

    const job = await svc.getJobById('j1', 'u1');

    expect(job).toMatchObject({ id: 'j1' });
    expect(prisma.job.findFirst).toHaveBeenCalledWith({ where: { id: 'j1', userId: 'u1' } });
  });

  it('throws NotFound for another user’s job', async () => {
    const svc = makeService(baseConfig, {
      job: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(svc.getJobById('j1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('JobsService.getJobs', () => {
  it('builds the where clause from filters and paginates', async () => {
    const prisma = {
      job: {
        findMany: vi.fn().mockResolvedValue([{ id: 'j1' }]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const svc = makeService(baseConfig, prisma);

    const result = await svc.getJobs('u1', { search: 'engineer', isBookmarked: true, page: 2, limit: 5 });

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1', isBookmarked: true, OR: expect.any(Array) }),
        skip: 5,
        take: 5,
      }),
    );
    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
  });
});

describe('JobsService.skill matching', () => {
  it('getJobDetails returns a zero match when the user has no resume', async () => {
    const svc = makeService(baseConfig, {
      job: {
        findFirst: vi.fn().mockResolvedValue({ id: 'j1', title: 'Engineer', description: '', requirements: '' }),
      },
      resume: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    const details = await svc.getJobDetails('j1', 'u1');

    expect(details.skillMatch).toEqual({ percentage: 0, matchedSkills: [], missingSkills: [] });
    expect(details.skillGap).toBeNull();
    expect(details.resumeId).toBeNull();
  });

  it('getJobDetails matches resume skills against the job text, offline', async () => {
    const svc = makeService(baseConfig, {
      job: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'j1',
          title: 'Full-stack Engineer',
          description: 'Works with typescript, react and postgresql. Experience with docker.',
          requirements: '',
        }),
      },
      resume: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'r1',
          textContent: 'Skilled in TypeScript, React, PostgreSQL and Docker.',
          feedback: {},
        }),
      },
    });

    const details = await svc.getJobDetails('j1', 'u1');

    expect(details.skillMatch.matchedSkills.sort()).toEqual(['docker', 'postgresql', 'react', 'typescript']);
    expect(details.skillMatch.percentage).toBe(100);
    expect(details.skillMatch.missingSkills).toEqual([]);
    expect(details.resumeId).toBe('r1');
  });
});
