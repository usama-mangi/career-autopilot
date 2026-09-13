import { describe, expect, it, vi } from 'vitest';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { InterviewPrepService } from './interview-prep.service';
import { AI_UNAVAILABLE_MESSAGE, AiUnavailableException } from '../common/ai-gateway';
import { makeLoggerSilent, makePrismaMock } from '../test-helpers/service-mocks';

function makeService(prisma: any, ai: any) {
  const svc = new InterviewPrepService(makePrismaMock(prisma) as any, ai as any);
  makeLoggerSilent(svc as any);
  return svc;
}

function makeAi(result: any = { title: 'Briefing' }) {
  return {
    chat: vi.fn().mockResolvedValue({ message: { content: 'json' } }),
    getResponseText: vi.fn().mockReturnValue('raw'),
    parseAIResponse: vi.fn().mockReturnValue(result),
  };
}

const failAi = () => {
  const ai = makeAi();
  ai.chat.mockRejectedValue(new Error('OpenAI API error (503): provider down'));
  return ai;
};

describe('InterviewPrepService AI gateway mapping', () => {
  it('generateCompanyBriefing returns the parsed result and persists it', async () => {
    const prisma = {
      interviewPrep: { create: vi.fn().mockResolvedValue({ id: 'ip1' }) },
    };
    const ai = makeAi({ overview: { name: 'Acme' } });
    const svc = makeService(prisma, ai);

    const result = await svc.generateCompanyBriefing('u1', {
      companyName: 'Acme',
      roleTitle: 'SWE',
    });

    expect(ai.chat).toHaveBeenCalledTimes(1);
    expect(prisma.interviewPrep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', type: 'company_briefing', companyName: 'Acme' }),
    });
    expect(result).toMatchObject({ id: 'ip1', overview: { name: 'Acme' } });
  });

  it('generateCompanyBriefing maps AI failure to 502 and persists nothing', async () => {
    const prisma = { interviewPrep: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    const err = await svc
      .generateCompanyBriefing('u1', { companyName: 'Acme', roleTitle: 'SWE' })
      .then(
        () => null,
        (e) => e,
      );

    expect(err).toBeInstanceOf(AiUnavailableException);
    expect(err.status).toBe(HttpStatus.BAD_GATEWAY);
    expect(err.getResponse()).toBe(AI_UNAVAILABLE_MESSAGE);
    expect(prisma.interviewPrep.create).not.toHaveBeenCalled();
  });

  it('generateTechnicalAssessment maps AI failure to 502', async () => {
    const prisma = { technicalPractice: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.generateTechnicalAssessment('u1', { roleTitle: 'Backend' }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.technicalPractice.create).not.toHaveBeenCalled();
  });

  it('generateBehavioralBank maps AI failure to 502', async () => {
    const prisma = { behavioralBank: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.generateBehavioralBank('u1', { roleTitle: 'Backend' }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.behavioralBank.create).not.toHaveBeenCalled();
  });

  it('generateCheatSheet maps AI failure to 502', async () => {
    const prisma = { interviewPrep: { create: vi.fn() } };
    const svc = makeService(prisma, failAi());

    await expect(
      svc.generateCheatSheet('u1', { companyName: 'Acme', roleTitle: 'SWE' }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
    expect(prisma.interviewPrep.create).not.toHaveBeenCalled();
  });

  it('mock interview turns map AI failure to 502 (private helper wrapped too)', async () => {
    const prisma = {
      mockInterviewSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'm1',
          userId: 'u1',
          status: 'in_progress',
          roleTitle: 'Backend',
          company: null,
          messages: [],
          totalQuestions: 1,
        }),
      },
    };
    const svc = makeService(prisma, failAi());

    const err = await svc.sendMockInterviewMessage('u1', 'm1', 'my answer').then(
      () => null,
      (e) => e,
    );

    expect(err).toBeInstanceOf(AiUnavailableException);
    expect(err.status).toBe(HttpStatus.BAD_GATEWAY);
  });

  it('read paths keep throwing NotFound (scoping preserved)', async () => {
    const prisma = { interviewPrep: { findFirst: vi.fn().mockResolvedValue(null) } };
    const svc = makeService(prisma, makeAi());

    await expect(svc.getCompanyBriefing('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.interviewPrep.findFirst).toHaveBeenCalledWith({
      where: { id: 'missing', userId: 'u1', type: 'company_briefing' },
    });
  });
});
