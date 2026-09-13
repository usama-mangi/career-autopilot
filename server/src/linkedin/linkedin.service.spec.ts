import { describe, expect, it, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { LinkedInService } from './linkedin.service';
import { AI_UNAVAILABLE_MESSAGE, AiUnavailableException } from '../common/ai-gateway';
import { makePrismaMock } from '../test-helpers/service-mocks';

function makeService(prisma: any, ai: any) {
  return new LinkedInService(makePrismaMock(prisma) as any, ai as any);
}

function makeAi(analysis: any = { overallScore: 80 }) {
  return {
    chat: vi.fn().mockResolvedValue({ message: { content: 'json' } }),
    getResponseText: vi.fn().mockReturnValue('raw text'),
    parseAIResponse: vi.fn().mockReturnValue(analysis),
  };
}

describe('LinkedInService.analyze', () => {
  it('persists the profile, runs the analysis, and stores the result', async () => {
    const prisma = {
      linkedInProfile: {
        create: vi.fn().mockResolvedValue({ id: 'p1' }),
        update: vi.fn().mockResolvedValue({ id: 'p1', analysisResult: { overallScore: 80 } }),
      },
    };
    const ai = makeAi();
    const svc = makeService(prisma, ai);

    const result = await svc.analyze('u1', { profileText: 'Senior engineer...', targetRole: 'Staff' });

    expect(prisma.linkedInProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', profileText: 'Senior engineer...' }),
    });
    expect(ai.chat).toHaveBeenCalledWith(
      [{ role: 'user', content: expect.stringContaining('Senior engineer') }],
      expect.objectContaining({ response_format: { type: 'json_object' } }),
    );
    expect(prisma.linkedInProfile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { analysisResult: { overallScore: 80 } },
    });
    expect(result.analysisResult).toEqual({ overallScore: 80 });
  });

  it('maps AI failures to 502 and does not store a half analysis', async () => {
    const prisma = {
      linkedInProfile: {
        create: vi.fn().mockResolvedValue({ id: 'p1' }),
        update: vi.fn(),
      },
    };
    const ai = makeAi();
    ai.chat.mockRejectedValue(new Error('OpenAI API error (503): overloaded'));
    const svc = makeService(prisma, ai);

    const err = await svc.analyze('u1', { profileText: 'text' }).then(
      () => null,
      (e) => e,
    );

    expect(err).toBeInstanceOf(AiUnavailableException);
    expect(err.status).toBe(HttpStatus.BAD_GATEWAY);
    expect(err.getResponse()).toBe(AI_UNAVAILABLE_MESSAGE);
    expect(prisma.linkedInProfile.update).not.toHaveBeenCalled();
  });
});

describe('LinkedInService.reanalyze', () => {
  it('scopes the lookup to the user before re-running the analysis', async () => {
    const prisma = {
      linkedInProfile: {
        findFirst: vi.fn().mockResolvedValue({ id: 'p1', userId: 'u1', profileText: 'text' }),
        update: vi.fn().mockResolvedValue({ id: 'p1' }),
      },
    };
    const ai = makeAi();
    const svc = makeService(prisma, ai);

    await svc.reanalyze('p1', 'u1', { targetRole: 'Staff Engineer' });

    expect(prisma.linkedInProfile.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', userId: 'u1' } });
    expect(prisma.linkedInProfile.update).toHaveBeenCalled();
  });

  it('maps AI failures on re-analysis to 502', async () => {
    const prisma = {
      linkedInProfile: {
        findFirst: vi.fn().mockResolvedValue({ id: 'p1', userId: 'u1', profileText: 'text' }),
        update: vi.fn(),
      },
    };
    const ai = makeAi();
    ai.chat.mockRejectedValue(new Error('connection reset'));
    const svc = makeService(prisma, ai);

    await expect(svc.reanalyze('p1', 'u1', { targetRole: 'Staff Engineer' })).rejects.toBeInstanceOf(
      AiUnavailableException,
    );
    expect(prisma.linkedInProfile.update).not.toHaveBeenCalled();
  });
});
