import { describe, expect, it, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { OfferNegotiationService } from './offer-negotiation.service';
import { AI_UNAVAILABLE_MESSAGE, AiUnavailableException } from '../common/ai-gateway';
import { makeLoggerSilent, makePrismaMock } from '../test-helpers/service-mocks';

function makeService(prisma: any, ai: any) {
  const svc = new OfferNegotiationService(makePrismaMock(prisma) as any, ai as any);
  makeLoggerSilent(svc as any);
  return svc;
}

function makeAi(result: any = { scores: [] }) {
  return {
    chat: vi.fn().mockResolvedValue({ message: { content: 'json' } }),
    getResponseText: vi.fn().mockReturnValue('raw'),
    parseAIResponse: vi.fn().mockReturnValue(result),
  };
}

const failAi = () => {
  const ai = makeAi();
  ai.chat.mockRejectedValue(new Error('OpenAI API error (500): upstream exploded'));
  return ai;
};

describe('OfferNegotiationService AI gateway mapping', () => {
  it('createComparison persists the parsed scoring and recommendation', async () => {
    const prisma = { offerComparison: { create: vi.fn().mockResolvedValue({ id: 'c1' }) } };
    const ai = makeAi({
      scores: [{ offerName: 'A', totalScore: 8, criterionScores: [] }],
      recommendation: 'Take A',
    });
    const svc = makeService(prisma, ai);

    await svc.createComparison('u1', {
      name: 'A vs B',
      offers: [{ id: 'o1', name: 'A', baseSalary: 100, location: 'x', remotePolicy: 'remote', benefits: [] }],
    });

    expect(ai.chat).toHaveBeenCalled();
    expect(prisma.offerComparison.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        name: 'A vs B',
        scores: [{ offerName: 'A', totalScore: 8, criterionScores: [] }],
        recommendation: 'Take A',
      }),
    });
  });

  it('createComparison maps AI failure to 502 and persists nothing', async () => {
    const prisma = { offerComparison: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    const err = await svc
      .createComparison('u1', { name: 'A vs B', offers: [] })
      .then(
        () => null,
        (e) => e,
      );

    expect(err).toBeInstanceOf(AiUnavailableException);
    expect(err.status).toBe(HttpStatus.BAD_GATEWAY);
    expect(err.getResponse()).toBe(AI_UNAVAILABLE_MESSAGE);
    expect(prisma.offerComparison.create).not.toHaveBeenCalled();
  });

  it('createCoach maps AI failure to 502', async () => {
    const prisma = { negotiationCoach: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.createCoach('u1', {
        companyName: 'Acme',
        roleTitle: 'SWE',
        offerDetails: { baseSalary: 100 },
      }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.negotiationCoach.create).not.toHaveBeenCalled();
  });

  it('calculateEquity maps AI failure to 502', async () => {
    const svc = makeService({}, failAi());

    await expect(
      svc.calculateEquity('u1', {
        roleTitle: 'SWE',
        equityDetails: {
          totalShares: 10000,
          sharePrice: 1.5,
          vestingSchedule: '4y',
          equityType: 'RSU',
          currentSalary: 100,
        },
      }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
  });

  it('analyzeBenefits maps AI failure to 502', async () => {
    const svc = makeService({}, failAi());

    await expect(
      svc.analyzeBenefits('u1', { roleTitle: 'SWE', companyName: 'Acme', benefits: ['health'], salary: 100 }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
  });

  it('createDecision maps AI failure to 502', async () => {
    const prisma = { offerDecision: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.createDecision('u1', { name: 'decision', criteria: [{ id: 'c1', name: 'pay', weight: 1 }], offers: [] }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.offerDecision.create).not.toHaveBeenCalled();
  });

  it('generateResignationLetter maps AI failure to 502', async () => {
    const prisma = { resignationLetter: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.generateResignationLetter('u1', { companyName: 'Acme', roleTitle: 'SWE' }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.resignationLetter.create).not.toHaveBeenCalled();
  });

  it('read paths keep throwing NotFound (scoping preserved)', async () => {
    const prisma = { offerComparison: { findFirst: vi.fn().mockResolvedValue(null) } };
    const svc = makeService(prisma, makeAi());

    await expect(svc.getComparison('u1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
});
