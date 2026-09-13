import { describe, expect, it, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { InterviewProcessService } from './interview-process.service';
import { AI_UNAVAILABLE_MESSAGE, AiUnavailableException } from '../common/ai-gateway';
import { makeLoggerSilent, makePrismaMock } from '../test-helpers/service-mocks';

function makeService(prisma: any, ai: any) {
  const svc = new InterviewProcessService(makePrismaMock(prisma) as any, ai as any);
  makeLoggerSilent(svc as any);
  return svc;
}

function makeAi(result: any = {}) {
  return {
    chat: vi.fn().mockResolvedValue({ message: { content: 'json' } }),
    getResponseText: vi.fn().mockReturnValue('raw'),
    parseAIResponse: vi.fn().mockReturnValue(result),
  };
}

const failAi = () => {
  const ai = makeAi();
  ai.chat.mockRejectedValue(new Error('OpenAI API error (429): rate limited'));
  return ai;
};

describe('InterviewProcessService AI gateway mapping', () => {
  it('generateFollowUpEmail returns the generated email text', async () => {
    const ai = makeAi();
    ai.getResponseText.mockReturnValue('Dear interviewer...');
    const svc = makeService({}, ai);

    const result = await svc.generateFollowUpEmail('u1', {
      type: 'thank_you',
      roleTitle: 'Backend Engineer',
      companyName: 'Acme',
      interviewerName: 'Jane',
    });

    expect(result).toMatchObject({
      type: 'thank_you',
      subject: 'Follow-up: Backend Engineer at Acme',
      body: 'Dear interviewer...',
    });
  });

  it('generateFollowUpEmail maps AI failure to 502 with the shared message', async () => {
    const svc = makeService({}, failAi());

    const err = await svc
      .generateFollowUpEmail('u1', { type: 'thank_you', roleTitle: 'BE', companyName: 'Acme' })
      .then(
        () => null,
        (e) => e,
      );

    expect(err).toBeInstanceOf(AiUnavailableException);
    expect(err.status).toBe(HttpStatus.BAD_GATEWAY);
    expect(err.getResponse()).toBe(AI_UNAVAILABLE_MESSAGE);
    expect(JSON.stringify(err.getResponse())).not.toContain('429');
  });

  it('generateCaseStudy maps AI failure to 502 and persists nothing', async () => {
    const prisma = { caseStudy: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.generateCaseStudy('u1', {
        companyName: 'Acme',
        roleTitle: 'SWE',
        title: 'Pricing',
        description: 'Design a pricing strategy',
      }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.caseStudy.create).not.toHaveBeenCalled();
  });
});
