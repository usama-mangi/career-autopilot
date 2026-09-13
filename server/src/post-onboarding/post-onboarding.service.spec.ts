import { describe, expect, it, vi } from 'vitest';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { PostOnboardingService } from './post-onboarding.service';
import { AI_UNAVAILABLE_MESSAGE, AiUnavailableException } from '../common/ai-gateway';
import { makeLoggerSilent, makePrismaMock } from '../test-helpers/service-mocks';

function makeService(prisma: any, ai: any) {
  const svc = new PostOnboardingService(makePrismaMock(prisma) as any, ai as any);
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
  ai.chat.mockRejectedValue(new Error('fetch failed'));
  return ai;
};

describe('PostOnboardingService AI gateway mapping', () => {
  it('createOnboardingPlan persists the parsed plan', async () => {
    const prisma = { onboardingPlan: { create: vi.fn().mockResolvedValue({ id: 'p1' }) } };
    const ai = makeAi({ milestones: [{ title: 'Meet the team' }], learningGoals: [], stakeholders: [], summary: 'Go' });
    const svc = makeService(prisma, ai);

    await svc.createOnboardingPlan('u1', { companyName: 'Acme', roleTitle: 'SWE' });

    expect(prisma.onboardingPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        milestones: [{ title: 'Meet the team' }],
        planType: '30-60-90',
      }),
    });
  });

  it('createOnboardingPlan maps AI failure to 502 and persists nothing', async () => {
    const prisma = { onboardingPlan: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    const err = await svc
      .createOnboardingPlan('u1', { companyName: 'Acme', roleTitle: 'SWE' })
      .then(
        () => null,
        (e) => e,
      );

    expect(err).toBeInstanceOf(AiUnavailableException);
    expect(err.status).toBe(HttpStatus.BAD_GATEWAY);
    expect(err.getResponse()).toBe(AI_UNAVAILABLE_MESSAGE);
    expect(prisma.onboardingPlan.create).not.toHaveBeenCalled();
  });

  it('createOnboardingChecklist maps AI failure to 502', async () => {
    const prisma = { onboardingChecklist: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.createOnboardingChecklist('u1', { companyName: 'Acme', roleTitle: 'SWE' }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.onboardingChecklist.create).not.toHaveBeenCalled();
  });

  it('createManagerAlignment maps AI failure to 502', async () => {
    const prisma = { managerAlignment: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.createManagerAlignment('u1', { companyName: 'Acme', roleTitle: 'SWE' }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.managerAlignment.create).not.toHaveBeenCalled();
  });

  it('createNetworkMap maps AI failure to 502', async () => {
    const prisma = { networkMap: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.createNetworkMap('u1', { companyName: 'Acme', roleTitle: 'SWE' }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.networkMap.create).not.toHaveBeenCalled();
  });

  it('createSkillRefresh maps AI failure to 502', async () => {
    const prisma = { skillRefresh: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.createSkillRefresh('u1', { companyName: 'Acme', roleTitle: 'SWE', techStack: ['react'] }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.skillRefresh.create).not.toHaveBeenCalled();
  });

  it('createFirst90DaysTracker maps AI failure to 502', async () => {
    const prisma = { first90DaysTracker: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.createFirst90DaysTracker('u1', { companyName: 'Acme', roleTitle: 'SWE' }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.first90DaysTracker.create).not.toHaveBeenCalled();
  });

  it('read paths keep throwing NotFound (scoping preserved)', async () => {
    const prisma = { onboardingPlan: { findFirst: vi.fn().mockResolvedValue(null) } };
    const svc = makeService(prisma, makeAi());

    await expect(svc.getOnboardingPlan('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
