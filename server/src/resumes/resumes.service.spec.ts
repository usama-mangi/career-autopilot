import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ResumesService } from './resumes.service';
import { AiUnavailableException, AI_UNAVAILABLE_MESSAGE } from '../common/ai-gateway';
import { makeLoggerSilent, makePrismaMock } from '../test-helpers/service-mocks';

/**
 * Fake AiService: chat returns a marker object, getResponseText unwraps it,
 * parseAIResponse is plain JSON.parse, getEmbedding maps keywords to 2-dim
 * unit vectors so cosine ranking is deterministic.
 */
function makeAiMock(responses: string[] = ['{}']) {
  let call = 0;
  return {
    chat: vi.fn().mockImplementation(async () => ({ marker: responses[Math.min(call++, responses.length - 1)] })),
    getResponseText: (resp: any) => resp.marker,
    parseAIResponse: <T = any>(text: string): T => JSON.parse(text),
    getEmbedding: vi.fn().mockImplementation(async (text: string) => {
      if (text.includes('react dashboards')) return [1, 0];
      if (text.includes('typescript tooling')) return [0.9, 0.1];
      if (text.includes('go microservices')) return [0.8, 0.6];
      if (text.includes('python data')) return [0.7, 0.7];
      if (text.includes('rust compiler')) return [0.6, 0.8];
      if (text.includes('legacy perl')) return [-1, 0];
      return [0, 1]; // the job description itself
    }),
  };
}

function makeService(prisma: any, ai: any = makeAiMock()) {
  const svc = new ResumesService(
    makePrismaMock(prisma) as any,
    { saveBuffer: vi.fn().mockReturnValue('uploads/file') } as any,
    ai as any,
    {} as any,
    {} as any,
  );
  makeLoggerSilent(svc as any);
  return svc;
}

describe('ResumesService basics', () => {
  it('remove deletes the resume when it belongs to the user', async () => {
    const prisma = {
      resume: {
        findFirst: vi.fn().mockResolvedValue({ id: 'r1' }),
        delete: vi.fn().mockResolvedValue({}),
      },
    };
    const svc = makeService(prisma);

    await svc.remove('r1', 'u1');

    expect(prisma.resume.findFirst).toHaveBeenCalledWith({ where: { id: 'r1', userId: 'u1' } });
    expect(prisma.resume.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('remove throws NotFound for another user’s resume', async () => {
    const svc = makeService({ resume: { findFirst: vi.fn().mockResolvedValue(null) } });

    await expect(svc.remove('r1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateApplicationStatus writes status and notes, scoped to the owner', async () => {
    const prisma = {
      resume: {
        findFirst: vi.fn().mockResolvedValue({ id: 'r1' }),
        update: vi.fn().mockResolvedValue({ id: 'r1' }),
      },
    };
    const svc = makeService(prisma);

    await svc.updateApplicationStatus('r1', 'u1', { status: 'applied', notes: 'sent via portal' });

    expect(prisma.resume.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { applicationStatus: 'applied', applicationNotes: 'sent via portal' },
    });
  });

  it('updateApplicationStatus throws NotFound when the resume is missing', async () => {
    const svc = makeService({ resume: { findFirst: vi.fn().mockResolvedValue(null) } });

    await expect(
      svc.updateApplicationStatus('r1', 'u1', { status: 'applied' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('saveTipFeedback sets, overwrites and clears keys', async () => {
    const prisma = {
      resume: {
        findFirst: vi.fn().mockResolvedValue({ id: 'r1', tipFeedback: { bullet1: 'up' } }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const svc = makeService(prisma);

    await svc.saveTipFeedback('r1', 'u1', 'bullet2', 'down');
    expect(prisma.resume.update).toHaveBeenLastCalledWith({
      where: { id: 'r1' },
      data: { tipFeedback: { bullet1: 'up', bullet2: 'down' } },
    });

    await svc.saveTipFeedback('r1', 'u1', 'bullet1', null);
    expect(prisma.resume.update).toHaveBeenLastCalledWith({
      where: { id: 'r1' },
      data: { tipFeedback: { bullet2: 'down' } },
    });
  });

  it('getReportByToken looks a resume up by share token only', async () => {
    const prisma = { resume: { findFirst: vi.fn().mockResolvedValue({ id: 'r1' }) } };
    const svc = makeService(prisma);

    await svc.getReportByToken('tok-123');

    expect(prisma.resume.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shareToken: 'tok-123' } }),
    );
  });

  it('submitSharedFeedback appends an entry and rejects unknown tokens', async () => {
    const prisma = {
      resume: {
        findFirst: vi.fn().mockResolvedValue({ id: 'r1', sharedFeedbacks: [] }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const svc = makeService(prisma);

    const feedback = await svc.submitSharedFeedback('tok', { name: 'Amy', comment: 'Great', rating: 5 });

    expect(feedback).toMatchObject({ name: 'Amy', rating: 5 });
    const stored = prisma.resume.update.mock.calls[0][0].data.sharedFeedbacks;
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toEqual(expect.any(String));

    (prisma.resume.findFirst as any).mockResolvedValue(null);
    await expect(svc.submitSharedFeedback('tok', { name: 'A', comment: 'b' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ResumesService.resume versions', () => {
  it('createResumeVersion demotes the current primary when isPrimary is set', async () => {
    const prisma = {
      resume: { findFirst: vi.fn().mockResolvedValue({ id: 'r1' }) },
      resumeVersion: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: 'v1' }),
      },
    };
    const svc = makeService(prisma);

    await svc.createResumeVersion('r1', 'u1', { name: 'Frontend', content: {}, isPrimary: true });

    expect(prisma.resumeVersion.updateMany).toHaveBeenCalledWith({
      where: { resumeId: 'r1', isPrimary: true },
      data: { isPrimary: false },
    });
    expect(prisma.resumeVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ resumeId: 'r1', name: 'Frontend', isPrimary: true }),
    });
  });

  it('getResumeVersion rejects versions belonging to another user', async () => {
    const svc = makeService({
      resumeVersion: {
        findUnique: vi.fn().mockResolvedValue({ id: 'v1', resume: { userId: 'someone-else' } }),
      },
    });

    await expect(svc.getResumeVersion('v1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('setPrimaryResumeVersion flips ownership-checked primary flags', async () => {
    const prisma = {
      resumeVersion: {
        findUnique: vi.fn().mockResolvedValue({ id: 'v1', resumeId: 'r1', resume: { userId: 'u1' } }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ id: 'v1', isPrimary: true }),
      },
    };
    const svc = makeService(prisma);

    await svc.setPrimaryResumeVersion('v1', 'u1');

    expect(prisma.resumeVersion.updateMany).toHaveBeenCalledWith({
      where: { resumeId: 'r1', isPrimary: true },
      data: { isPrimary: false },
    });
    expect(prisma.resumeVersion.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { isPrimary: true },
    });
  });

  it('updateContent renders generated content into stored text', async () => {
    const prisma = {
      resume: {
        findFirst: vi.fn().mockResolvedValue({ id: 'r1' }),
        update: vi.fn().mockResolvedValue({ id: 'r1' }),
      },
    };
    const svc = makeService(prisma);

    await svc.updateContent('r1', 'u1', {
      generatedContent: {
        summary: 'Backend engineer.',
        experience: [{ title: 'SWE', company: 'Acme', startDate: '2024', endDate: '2026', bullets: ['Shipped APIs'] }],
        skills: ['TypeScript', 'PostgreSQL'],
      },
      contactInfo: { name: 'Sam Lee', email: 'sam@x.dev', phone: '555-0100' },
    });

    const data = prisma.resume.update.mock.calls[0][0].data;
    expect(data.generatedContent.summary).toBe('Backend engineer.');
    expect(data.textContent).toContain('Sam Lee');
    expect(data.textContent).toContain('sam@x.dev | 555-0100');
    expect(data.textContent).toContain('EXPERIENCE');
    expect(data.textContent).toContain('• Shipped APIs');
    expect(data.textContent).toContain('SKILLS');
    expect(data.textContent.length).toBeGreaterThanOrEqual(data.textPreview.length);
  });
});

describe('ResumesService.generateFromProfile', () => {
  const projects = [
    { name: 'React Dashboards', title: 'React Dashboards', description: 'react dashboards', technologies: [] },
    { name: 'TS Tooling', title: 'TS Tooling', description: 'typescript tooling', technologies: [] },
    { name: 'Go Services', title: 'Go Services', description: 'go microservices', technologies: [] },
    { name: 'Python ETL', title: 'Python ETL', description: 'python data', technologies: [] },
    { name: 'Rust Compiler', title: 'Rust Compiler', description: 'rust compiler', technologies: [] },
    { name: 'Legacy Perl', title: 'Legacy Perl', description: 'legacy perl', technologies: [] },
  ];

  function makeProfileService(ai: any, extraPrisma: any = {}) {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', name: 'Sam Lee', headline: 'SWE', email: 'sam@x.dev' }) },
      userProfile: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'u1',
          experience: [],
          education: [],
          skills: ['TypeScript'],
          projects,
        }),
      },
      resume: {
        create: vi.fn().mockResolvedValue({ id: 'r1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'r1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      ...extraPrisma,
    };
    const svc = makeService(prisma, ai);
    return { svc, prisma };
  }

  it('ranks projects by embedding relevance to the job description', async () => {
    const ai = makeAiMock([JSON.stringify({ summary: 'S', skills: ['TypeScript'] }), '{}']);
    const { svc } = makeProfileService(ai);

    await svc.generateFromProfile('u1', { targetRole: 'Frontend', jobDescription: 'Build react dashboards for us' });

    // First chat call is resume generation; the prompt should list the five
    // most relevant projects in relevance order and drop the worst match.
    const generationPrompt = ai.chat.mock.calls[0][0][1].content;
    expect(generationPrompt).not.toContain('Legacy Perl');
    const order = ['React Dashboards', 'TS Tooling', 'Go Services', 'Python ETL', 'Rust Compiler'].map(
      (name) => generationPrompt.indexOf(name),
    );
    expect(order.every((idx) => idx >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('caches embeddings per service instance', async () => {
    const ai = makeAiMock([JSON.stringify({ summary: 'S' }), '{}']);
    const { svc } = makeProfileService(ai);

    await svc.generateFromProfile('u1', { jobDescription: 'Build react dashboards' });
    expect(ai.getEmbedding).toHaveBeenCalledTimes(7); // jd + 6 projects

    await svc.generateFromProfile('u1', { jobDescription: 'Build react dashboards' });
    expect(ai.getEmbedding).toHaveBeenCalledTimes(7); // all cache hits
  });

  it('falls back to profile data when the AI call fails', async () => {
    const ai = makeAiMock();
    ai.chat.mockRejectedValue(new Error('AI down'));
    const { svc, prisma } = makeProfileService(ai);

    await svc.generateFromProfile('u1', { targetRole: 'Frontend' });

    const created = prisma.resume.create.mock.calls[0][0].data;
    expect(created.generatedContent).toBeNull();
    expect(created.textContent).toContain('Sam Lee');
    expect(created.textContent).toContain('SKILLS');
    expect(created.textContent).toContain('TypeScript');
  });

  it('REGRESSION: survives an embeddings outage by falling back to all projects', async () => {
    const ai = makeAiMock();
    ai.getEmbedding.mockRejectedValue(new Error('embeddings down'));
    ai.chat.mockRejectedValue(new Error('AI down'));
    const { svc, prisma } = makeProfileService(ai);

    // Must resolve (best-effort), not throw 502: this path is designed to
    // produce a profile-based resume even with every AI dependency down.
    await svc.generateFromProfile('u1', { targetRole: 'Frontend', jobDescription: 'Build react dashboards' });

    const created = prisma.resume.create.mock.calls[0][0].data;
    expect(created.generatedContent).toBeNull();
    // All projects kept, including the worst embedding match that ranking
    // would have dropped.
    expect(created.textContent).toContain('Legacy Perl');
    expect(created.textContent).toContain('React Dashboards');
  });
});

describe('ResumesService AI error contract', () => {
  /** Hard-fail generators persist their result under this field. */
  const jsonGenerators = [
    ['analyzeSkillGap', 'skillGapResult', { jobDescription: 'jd' }],
    ['generateInterviewQuestions', 'interviewQuestionsResult', { questionCount: 5 }],
    ['estimateSalary', 'salaryEstimateResult', { targetLocation: 'Berlin' }],
    ['suggestTemplates', 'templateSuggestionsResult', {}],
    ['compareMultipleJds', 'multiJdResult', { jobEntries: [{ title: 'A', description: 'B' }] }],
  ] as const;

  function aiOutageService() {
    const ai = makeAiMock();
    ai.chat.mockRejectedValue(new Error('upstream exploded'));
    const prisma = {
      resume: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'r1',
          jobTitle: 'SWE',
          jobDescription: 'jd',
          textContent: 'resume body',
          feedback: {},
        }),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: 'r2' }),
      },
      coverLetter: { create: vi.fn().mockResolvedValue({ id: 'cl1' }) },
    };
    const svc = makeService(prisma, ai);
    return { svc, prisma, ai };
  }

  async function expectAiUnavailable(promise: Promise<unknown>) {
    await expect(promise).rejects.toBeInstanceOf(AiUnavailableException);
    try {
      await promise;
    } catch (error) {
      expect((error as AiUnavailableException).getStatus()).toBe(502);
      expect((error as Error).message).toBe(AI_UNAVAILABLE_MESSAGE);
      // Upstream error text must never leak through the 502.
      expect((error as Error).message).not.toContain('upstream exploded');
    }
  }

  it('generateCoverLetter maps an AI outage to 502 and persists nothing', async () => {
    const { svc, prisma } = aiOutageService();

    await expectAiUnavailable(
      svc.generateCoverLetter('r1', 'u1', { companyName: 'Acme' }),
    );
    expect(prisma.coverLetter.create).not.toHaveBeenCalled();
  });

  it('generateTailoredResume maps an AI outage to 502 and creates no resume', async () => {
    const { svc, prisma } = aiOutageService();

    await expectAiUnavailable(
      svc.generateTailoredResume('r1', 'u1', { jobDescription: 'jd' }),
    );
    expect(prisma.resume.create).not.toHaveBeenCalled();
  });

  it.each(jsonGenerators)(
    '%s maps an AI outage to 502 and persists nothing',
    async (method, _field, body) => {
      const { svc, prisma } = aiOutageService();

      await expectAiUnavailable(
        (svc as any)[method]('r1', 'u1', body),
      );
      expect(prisma.resume.update).not.toHaveBeenCalled();
    },
  );

  it.each(jsonGenerators)(
    '%s maps unparseable AI output to 502 as well',
    async (method, _field, body) => {
      const { svc, prisma } = aiOutageService();
      // makeAiMock's chat resolves { marker: text } and parseAIResponse is
      // JSON.parse — a non-JSON marker reproduces a real parse failure.
      (svc as any).aiService.chat.mockResolvedValue({ marker: 'sorry, I cannot parse that' });

      await expectAiUnavailable((svc as any)[method]('r1', 'u1', body));
      expect(prisma.resume.update).not.toHaveBeenCalled();
    },
  );

  it('returns 404 without calling the AI when the resume belongs to another user', async () => {
    const { svc, ai, prisma } = aiOutageService();
    prisma.resume.findFirst.mockResolvedValue(null);

    await expect(svc.generateCoverLetter('r1', 'u1', { companyName: 'Acme' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it('keeps the trailing ATS analysis best-effort in generateTailoredResume', async () => {
    const ai = makeAiMock();
    ai.chat
      .mockResolvedValueOnce({ marker: JSON.stringify({ tailoredResume: { summary: 'S', skills: ['TS'] } }) })
      .mockRejectedValueOnce(new Error('AI down during ATS'));
    const prisma = {
      resume: {
        findFirst: vi.fn().mockResolvedValue({ id: 'r1', textContent: 'body', jobTitle: 'SWE', feedback: {} }),
        create: vi.fn().mockResolvedValue({ id: 'r2' }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const svc = makeService(prisma, ai);

    const result = await svc.generateTailoredResume('r1', 'u1', { jobDescription: 'jd' });

    expect(result.newResumeId).toBe('r2');
    expect(result.tailoredResume).toEqual({ summary: 'S', skills: ['TS'] });
    // The ATS failure was swallowed, not propagated.
    expect(prisma.resume.update).not.toHaveBeenCalled();
  });

  it('keeps analyze() best-effort: an AI outage resolves with empty feedback', async () => {
    const { svc, prisma } = aiOutageService();

    const feedback = await svc.analyze('r1', 'u1');

    expect(feedback).toEqual({});
    expect(prisma.resume.update).not.toHaveBeenCalled();
  });

  it('keeps create() analysis best-effort: upload still succeeds with fallback feedback', async () => {
    const ai = makeAiMock();
    ai.chat.mockRejectedValue(new Error('AI down'));
    const prisma = {
      resume: {
        create: vi.fn().mockResolvedValue({ id: 'r1' }),
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ id: 'r1' }),
      },
    };
    const parser = { parse: vi.fn().mockResolvedValue({ format: 'txt', text: 'content', preview: 'prev' }) };
    const svc = new ResumesService(
      makePrismaMock(prisma) as any,
      { saveBuffer: vi.fn().mockReturnValue('uploads/file') } as any,
      ai as any,
      parser as any,
      { convertPdfToImage: vi.fn() } as any,
    );
    makeLoggerSilent(svc as any);

    const resume = await svc.create(
      'u1',
      { buffer: Buffer.from('x'), originalname: 'resume.txt', mimetype: 'text/plain' } as any,
      'Acme',
      'SWE',
      'jd',
    );

    expect(resume).not.toBeNull();
    expect((resume as { id: string }).id).toBe('r1');
    // Second update stores the fallback feedback shape.
    const lastUpdate = prisma.resume.update.mock.calls.at(-1)?.[0];
    expect(lastUpdate.where).toEqual({ id: 'r1' });
    expect(lastUpdate.data.feedback).toHaveProperty('ATS');
  });
});
