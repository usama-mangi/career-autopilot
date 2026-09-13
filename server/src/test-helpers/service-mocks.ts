import { vi } from 'vitest';

/**
 * Explicit Prisma mock: pass exactly the model methods the test needs, e.g.
 *   makePrismaMock({ job: { findFirst: vi.fn().mockResolvedValue(null) } })
 * Anything a service calls but the test did not stub throws "not a function",
 * which surfaces unmocked queries instead of silently passing.
 */
export function makePrismaMock(overrides: Record<string, unknown> = {}): any {
  return structuredCloneSafe(overrides);
}

/**
 * Redis mock with the default methods services call. Override any of them,
 * e.g. makeRedisMock({ incrementRateLimit: vi.fn().mockResolvedValue(11) }).
 */
export function makeRedisMock(overrides: Record<string, unknown> = {}): any {
  return {
    incrementRateLimit: vi.fn().mockResolvedValue(1),
    invalidateJobCache: vi.fn().mockResolvedValue(undefined),
    setCachedJobs: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Minimal BullMQ Queue stand-in for constructors that only store it. */
export function makeQueueMock(): any {
  return { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };
}

/** Silence NestJS Logger output for a service instance. */
export function makeLoggerSilent(service: { logger?: any }) {
  if (!service.logger) return;
  for (const method of ['log', 'warn', 'error', 'debug', 'verbose']) {
    if (typeof service.logger[method] === 'function') {
      vi.spyOn(service.logger, method).mockImplementation(() => undefined);
    }
  }
}

function structuredCloneSafe(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...overrides };
}
