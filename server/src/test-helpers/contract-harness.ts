import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import { vi } from 'vitest';
import { ExtensionController } from '../extension/extension.controller';
import { ExtensionService } from '../extension/extension.service';
import { InterviewProcessController } from '../interview-process/interview-process.controller';
import { InterviewProcessService } from '../interview-process/interview-process.service';
import { JobsController } from '../jobs/jobs.controller';
import { JobsService } from '../jobs/jobs.service';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { makePrismaMock, makeRedisMock, makeQueueMock } from './service-mocks';
import { makeConfigService } from './fetch-mock';

/**
 * Builds a real Nest application over the production controllers and
 * services, with every external boundary replaced:
 *
 *  - PrismaService: explicit per-model mocks (unmocked methods throw).
 *  - RedisService: the methods JobsService uses.
 *  - BullMQ Queue: add/remove record calls.
 *  - ConfigService: explicit values (JSEARCH_API_KEY set by default).
 *  - SessionGuard: overridden so tests pick the authenticated user via
 *    .set('x-test-user-id', '...') without touching Better Auth.
 *
 * The ValidationPipe uses the exact options from main.ts, so a request that
 * passes here is guaranteed to pass the real boot path and vice versa.
 */
export const MAIN_VALIDATION_PIPE = new ValidationPipe({
  whitelist: true,
  transform: true,
});

export const TEST_USER = 'user-11111111-1111-4111-8111-111111111111';
export const OTHER_USER = 'user-22222222-2222-4222-8222-222222222222';

export interface ContractHarness {
  app: INestApplication;
  prisma: Record<string, Record<string, any>>;
  ai: { chat: any; parseAIResponse: any; getResponseText: any };
}

export async function buildContractHarness(
  prismaOverrides: Record<string, Record<string, any>> = {},
  options: {
    jsearchApiKey?: string | null;
    redisOverrides?: Record<string, any>;
  } = {},
): Promise<ContractHarness> {
  const prisma = makePrismaMock(prismaOverrides);
  const redis = makeRedisMock({
    incrementRateLimit: vi.fn().mockResolvedValue(1),
    invalidateJobCache: vi.fn().mockResolvedValue(undefined),
    setCachedJobs: vi.fn().mockResolvedValue(undefined),
    ...options.redisOverrides,
  });
  const queue = makeQueueMock();
  const ai = {
    chat: vi.fn().mockResolvedValue({ message: { role: 'assistant', content: '{}' } }),
    parseAIResponse: vi.fn().mockReturnValue({}),
    getResponseText: vi.fn().mockReturnValue('{}'),
  };
  const config = makeConfigService(
    options.jsearchApiKey === null
      ? {}
      : {
          JSEARCH_API_KEY: options.jsearchApiKey ?? 'test-jsearch-key',
          JSEARCH_API_HOST: 'jsearch.test',
        },
  );

  const guardOverride = {
    canActivate: (ctx: any) => {
      const req = ctx.switchToHttp().getRequest();
      req.user = { userId: req.headers['x-test-user-id'] ?? TEST_USER };
      return true;
    },
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [ExtensionController, InterviewProcessController, JobsController],
    providers: [
      ExtensionService,
      InterviewProcessService,
      JobsService,
      { provide: PrismaService, useValue: prisma },
      { provide: RedisService, useValue: redis },
      { provide: getQueueToken('search-alerts'), useValue: queue },
      { provide: AiService, useValue: ai },
      { provide: ConfigService, useValue: config },
    ],
  })
    .overrideGuard(SessionGuard)
    .useValue(guardOverride)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalPipes(MAIN_VALIDATION_PIPE);
  await app.init();

  return { app, prisma, ai };
}

export async function closeContractHarness(h?: ContractHarness | null) {
  if (h?.app) await h.app.close();
}

/** supertest wrapper that authenticates every request as the given user. */
export function authenticated(server: any, userId: string = TEST_USER) {
  const send = (make: (s: any) => any) => make(request(server)).set('x-test-user-id', userId);
  return {
    get: (url: string) => send((s) => s.get(url)),
    post: (url: string) => send((s) => s.post(url)),
    patch: (url: string) => send((s) => s.patch(url)),
    put: (url: string) => send((s) => s.put(url)),
    delete: (url: string) => send((s) => s.delete(url)),
  };
}
