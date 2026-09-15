import { Injectable, NotFoundException } from '@nestjs/common';
import { withAiGateway } from '../common/ai-gateway';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { AiService } from '../ai/ai.service';
import { ResumeParserService } from './resume-parser.service';
import { PdfToImageService } from './pdf-to-image.service';
import {
  ANALYSIS_SYSTEM_MESSAGE,
  prepareInstructions,
  prepareCoverLetterInstructions,
  prepareSkillGapInstructions,
  prepareInterviewQuestionsInstructions,
  prepareSalaryEstimationInstructions,
  prepareMultiJdInstructions,
  prepareTemplateSuggestionsInstructions,
  prepareTailoredResumeInstructions,
  prepareResumeGenerationInstructions,
} from '../ai/prompts';

@Injectable()
export class ResumesService {
  private embeddingCache = new Map<string, number[]>();

  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    private aiService: AiService,
    private resumeParser: ResumeParserService,
    private pdfToImage: PdfToImageService,
  ) {}

  private async getEmbeddingCached(text: string): Promise<number[]> {
    const key = text.toLowerCase().trim();
    const cached = this.embeddingCache.get(key);
    if (cached) return cached;
    const embedding = await this.aiService.getEmbedding(text);
    this.embeddingCache.set(key, embedding);
    if (this.embeddingCache.size > 500) {
      const firstKey = this.embeddingCache.keys().next().value!;
      this.embeddingCache.delete(firstKey);
    }
    return embedding;
  }

  private async findRelevantProjects(
    allProjects: any[],
    jobDescription: string,
    topK = 5,
  ) {
    if (!allProjects.length) return [];
    const jdEmbedding = await this.getEmbeddingCached(jobDescription);
    const projectsWithScores = await Promise.all(
      allProjects.map(async (project) => {
        const text = `${project.name || ''} ${project.description || ''} ${(project.technologies || []).join(' ')}`;
        const projEmbedding = await this.getEmbeddingCached(text);
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < jdEmbedding.length; i++) {
          dot += jdEmbedding[i] * projEmbedding[i];
          normA += jdEmbedding[i] * jdEmbedding[i];
          normB += projEmbedding[i] * projEmbedding[i];
        }
        const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));
        return { project, score };
      }),
    );
    projectsWithScores.sort((a, b) => b.score - a.score);
    return projectsWithScores.slice(0, topK).map((p) => p.project);
  }

  async create(
    userId: string,
    file: Express.Multer.File,
    companyName: string,
    jobTitle: string,
    jobDescription: string,
  ) {
    const parseResult = await this.resumeParser.parse(file.buffer, file.mimetype as any);
    const preview = parseResult.preview;
    const filePath = this.uploadService.saveBuffer(file.buffer, file.originalname);
    let imagePath: string | undefined;
    try {
      if (parseResult.format === 'pdf') {
        const imageBuffer = await this.pdfToImage.convertPdfToImage(file.buffer);
        if (imageBuffer) {
          imagePath = this.uploadService.saveBuffer(imageBuffer, `${file.originalname}.png`);
        }
      }
    } catch {}

    const resume = await this.prisma.resume.create({
      data: {
        user: { connect: { id: userId } },
        companyName: companyName || "",
        jobTitle: jobTitle || "",
        jobDescription: jobDescription || "",
        fileName: file.originalname,
        textPreview: preview,
        textContent: parseResult.text,
        filePath,
        imagePath,
        format: parseResult.format,
        feedback: {},
      },
    });

    let feedback: any = {};
    try {
      const aiResponse = await this.aiService.chat([
        { role: 'system', content: ANALYSIS_SYSTEM_MESSAGE },
        { role: 'user', content: prepareInstructions({ jobTitle: jobTitle || 'Resume', jobDescription: jobDescription || '' }) },
      ]);
      feedback = this.aiService.parseAIResponse(this.aiService.getResponseText(aiResponse));
      if (feedback && Object.keys(feedback).length > 0) {
        await this.prisma.resume.update({
          where: { id: resume.id },
          data: { feedback },
        });
      }
    } catch {}

    const fallbackFeedback = {
      ATS: { score: 0, keywords: { matched: [], missing: [] }, strengths: [], weaknesses: [] },
      content: { summary: '', experience: [], education: [], skills: [], projects: [] },
    };
    await this.prisma.resume.update({
      where: { id: resume.id },
      // `feedback` is {} whenever the best-effort analysis failed — prefer the
      // shaped fallback over an empty object so clients always get a full
      // feedback structure (scores default to 0).
      data: {
        feedback:
          feedback && Object.keys(feedback).length > 0
            ? feedback
            : fallbackFeedback,
      },
    });

    return this.findById(resume.id, userId);
  }

  async findAll(userId: string) {
    return this.prisma.resume.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyName: true,
        jobTitle: true,
        jobDescription: true,
        fileName: true,
        format: true,
        filePath: true,
        imagePath: true,
        textPreview: true,
        feedback: true,
        generatedContent: true,
        createdAt: true,
        updatedAt: true,
        applicationStatus: true,
        applicationNotes: true,
      },
    });
  }

  async findById(id: string, userId: string) {
    return this.prisma.resume.findFirst({
      where: { id, userId },
    });
  }

  async remove(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    await this.prisma.resume.delete({ where: { id } });
    return { message: 'Resume deleted successfully' };
  }

  async updateContent(
    id: string,
    userId: string,
    body: { generatedContent: any; contactInfo?: any },
  ) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    const { generatedContent, contactInfo } = body;
    const headerParts: string[] = [];
    if (contactInfo?.name) headerParts.push(contactInfo.name);
    if (contactInfo?.headline) headerParts.push(contactInfo.headline);
    const contactLine: string[] = [];
    if (contactInfo?.email) contactLine.push(contactInfo.email);
    if (contactInfo?.phone) contactLine.push(contactInfo.phone);
    if (contactInfo?.location) contactLine.push(contactInfo.location);
    if (contactLine.length) headerParts.push(contactLine.join(' | '));
    if (contactInfo?.linkedinUrl) headerParts.push(`LinkedIn: ${contactInfo.linkedinUrl}`);
    if (contactInfo?.githubUrl) headerParts.push(`GitHub: ${contactInfo.githubUrl}`);
    if (contactInfo?.websiteUrl) headerParts.push(`Website: ${contactInfo.websiteUrl}`);
    const sections: string[] = [];
    if (generatedContent.summary) {
      sections.push('PROFESSIONAL SUMMARY', generatedContent.summary, '');
    }
    if (generatedContent.experience?.length) {
      sections.push('EXPERIENCE');
      for (const exp of generatedContent.experience) {
        sections.push(`${exp.title || 'Role'} at ${exp.company || 'Company'}`);
        const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ');
        if (dates) sections.push(dates);
        if (exp.bullets?.length) {
          for (const bullet of exp.bullets) sections.push(`• ${bullet}`);
        }
        sections.push('');
      }
    }
    if (generatedContent.education?.length) {
      sections.push('EDUCATION');
      for (const edu of generatedContent.education) {
        const degree = [edu.degree, edu.field].filter(Boolean).join(' in ');
        sections.push(`${degree || 'Degree'} — ${edu.school || 'Institution'}`);
        const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
        if (dates) sections.push(dates);
        sections.push('');
      }
    }
    if (generatedContent.skills?.length) {
      sections.push('SKILLS', generatedContent.skills.join(', '), '');
    }
    if (generatedContent.projects?.length) {
      sections.push('PROJECTS');
      for (const proj of generatedContent.projects) {
        sections.push(proj.name || 'Project');
        if (proj.description) sections.push(proj.description);
        if (proj.technologies?.length) sections.push(`Tech: ${proj.technologies.join(', ')}`);
        sections.push('');
      }
    }
    const textContent = [...headerParts, '', ...sections].join('\n').trim();
    return this.prisma.resume.update({
      where: { id },
      data: {
        generatedContent,
        textPreview: textContent.substring(0, 500),
        textContent,
      },
    });
  }

  async generateFromProfile(
    userId: string,
    body: { targetRole?: string; jobDescription?: string; companyName?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) profile = await this.prisma.userProfile.create({ data: { userId } });

    const experience = (profile.experience as any[]) || [];
    const education = (profile.education as any[]) || [];
    const skills = profile.skills || [];
    const allProjects = (profile.projects as any[]) || [];
    let projectsForAI = allProjects;
    if (allProjects.length && body.jobDescription?.trim()) {
      // Best-effort: smart project ranking needs the embeddings API. If it is
      // down, fall back to all projects instead of failing a path that is
      // designed to survive AI outages.
      try {
        projectsForAI = await this.findRelevantProjects(allProjects, body.jobDescription, 5);
      } catch {
        projectsForAI = allProjects;
      }
    }
    const smartProjects = projectsForAI.map((p) => ({
      name: p.name || p.title,
      description: p.description,
      technologies: p.technologies || [],
      role: p.role,
    }));

    let generatedContent: any = null;
    let resumeText = '';

    try {
      const instructions = prepareResumeGenerationInstructions({
        summary: user.summary || undefined,
        experience,
        education,
        skills,
        projects: smartProjects,
        jobDescription: body.jobDescription || undefined,
        targetRole: body.targetRole || undefined,
      });

      const aiResponse = await this.aiService.chat(
        [
          { role: 'system', content: 'You are an expert resume writer. Return ONLY a valid JSON object.' },
          { role: 'user', content: instructions },
        ],
        { response_format: { type: 'json_object' }, temperature: 0.3 },
      );

      generatedContent = this.aiService.parseAIResponse<any>(
        this.aiService.getResponseText(aiResponse),
      );
    } catch {
      generatedContent = null;
    }

    const headerParts: string[] = [];
    if (user.name) headerParts.push(user.name);
    if (user.headline) headerParts.push(user.headline);
    const contactLine: string[] = [];
    if (user.email) contactLine.push(user.email);
    if (user.phone) contactLine.push(user.phone);
    if (user.location) contactLine.push(user.location);
    if (contactLine.length) headerParts.push(contactLine.join(' | '));
    if (user.linkedinUrl) headerParts.push(`LinkedIn: ${user.linkedinUrl}`);
    if (user.githubUrl) headerParts.push(`GitHub: ${user.githubUrl}`);
    if (user.websiteUrl) headerParts.push(`Website: ${user.websiteUrl}`);

    if (generatedContent) {
      const sections: string[] = [];
      if (generatedContent.summary) {
        sections.push('PROFESSIONAL SUMMARY', generatedContent.summary, '');
      }
      if (generatedContent.experience?.length) {
        sections.push('EXPERIENCE');
        for (const exp of generatedContent.experience) {
          sections.push(`${exp.title || 'Role'} at ${exp.company || 'Company'}`);
          const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ');
          if (dates) sections.push(dates);
          if (exp.bullets?.length) {
            for (const bullet of exp.bullets) sections.push(`• ${bullet}`);
          }
          sections.push('');
        }
      }
      if (generatedContent.education?.length) {
        sections.push('EDUCATION');
        for (const edu of generatedContent.education) {
          const degree = [edu.degree, edu.field].filter(Boolean).join(' in ');
          sections.push(`${degree || 'Degree'} — ${edu.school || 'Institution'}`);
          const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
          if (dates) sections.push(dates);
          sections.push('');
        }
      }
      if (generatedContent.skills?.length) {
        sections.push('SKILLS', generatedContent.skills.join(', '), '');
      }
      if (generatedContent.projects?.length) {
        sections.push('PROJECTS');
        for (const proj of generatedContent.projects) {
          sections.push(proj.name || 'Project');
          if (proj.description) sections.push(proj.description);
          if (proj.technologies?.length) sections.push(`Tech: ${proj.technologies.join(', ')}`);
          sections.push('');
        }
      }
      resumeText = [...headerParts, '', ...sections].join('\n');
    } else {
      const sections: string[] = [];
      if (user.summary) {
        sections.push('PROFESSIONAL SUMMARY', user.summary, '');
      }
      if (experience.length) {
        sections.push('EXPERIENCE');
        for (const exp of experience) {
          sections.push(`${exp.title || 'Role'} at ${exp.company || 'Company'}`);
          const dates: string[] = [];
          if (exp.startDate) dates.push(exp.startDate);
          if (exp.endDate || exp.isCurrent) dates.push(exp.isCurrent ? 'Present' : exp.endDate);
          if (dates.length) sections.push(dates.join(' - '));
          if (exp.description) sections.push(exp.description);
          sections.push('');
        }
      }
      if (education.length) {
        sections.push('EDUCATION');
        for (const edu of education) {
          const degree = [edu.degree, edu.field].filter(Boolean).join(' in ');
          sections.push(`${degree || 'Degree'} — ${edu.school || 'Institution'}`);
          const dates: string[] = [];
          if (edu.startDate) dates.push(edu.startDate);
          if (edu.endDate) dates.push(edu.endDate);
          if (dates.length) sections.push(dates.join(' - '));
          sections.push('');
        }
      }
      if (skills.length) {
        sections.push('SKILLS', skills.join(', '), '');
      }
      if (smartProjects.length) {
        sections.push('PROJECTS');
        for (const proj of smartProjects) {
          sections.push(`${proj.name || 'Project'}`);
          if (proj.description) sections.push(proj.description);
          if (proj.technologies?.length) sections.push(`Tech: ${proj.technologies.join(', ')}`);
          sections.push('');
        }
      }
      resumeText = [...headerParts, '', ...sections].join('\n');
    }

    const resume = await this.prisma.resume.create({
      data: {
        user: { connect: { id: userId } },
        companyName: body.companyName || null,
        jobTitle: body.targetRole || user.headline || 'Resume',
        jobDescription: body.jobDescription || null,
        fileName: `generated-${Date.now()}.txt`,
        format: 'txt',
        filePath: '',
        textPreview: resumeText.substring(0, 500),
        textContent: resumeText,
        generatedContent,
        feedback: {},
      },
    });

    try {
      const instructions = prepareInstructions({
        jobTitle: body.targetRole || user.headline || 'Resume',
        jobDescription: body.jobDescription || '',
      });
      const feedback = await this.aiService.chat([
        { role: 'system', content: ANALYSIS_SYSTEM_MESSAGE },
        { role: 'user', content: instructions },
      ]);
      const parsed = this.aiService.parseAIResponse(this.aiService.getResponseText(feedback));
      if (parsed) {
        await this.prisma.resume.update({
          where: { id: resume.id },
          data: { feedback: parsed },
        });
      }
    } catch {}

    return this.findById(resume.id, userId);
  }

  async analyze(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');

    let feedback: any = {};
    try {
      const aiResponse = await this.aiService.chat([
        { role: 'system', content: ANALYSIS_SYSTEM_MESSAGE },
        {
          role: 'user',
          content: prepareInstructions({
            jobTitle: resume.jobTitle || 'Resume',
            jobDescription: resume.jobDescription || '',
          }),
        },
      ]);
      feedback = this.aiService.parseAIResponse(this.aiService.getResponseText(aiResponse));
    } catch {}

    if (feedback && Object.keys(feedback).length > 0) {
      await this.prisma.resume.update({
        where: { id },
        data: { feedback },
      });
    }

    return feedback;
  }

  async generateCoverLetter(
    id: string,
    userId: string,
    body: { companyName: string; hiringManager?: string; additionalContext?: string },
  ) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');

    const prompt = prepareCoverLetterInstructions({
      jobTitle: resume.jobTitle || '',
      jobDescription: resume.jobDescription || '',
      companyName: body.companyName,
      resumeText: resume.textContent || '',
      feedback: JSON.stringify(resume.feedback || {}),
      hiringManager: body.hiringManager,
      additionalContext: body.additionalContext,
    });

    // Hard-fail AI path (chat → text → persist): a failed generation must
    // surface as 502 with the shared client-safe message, not a raw 500.
    return withAiGateway('ResumesService.generateCoverLetter', async () => {
      const aiResponse = await this.aiService.chat([
        { role: 'system', content: 'You are an expert cover letter writer. Return ONLY the cover letter text.' },
        { role: 'user', content: prompt },
      ]);

      const result = this.aiService.getResponseText(aiResponse);
      return this.prisma.coverLetter.create({
        data: {
          resumeId: resume.id,
          content: result,
          companyName: body.companyName,
          hiringManager: body.hiringManager || null,
        },
      });
    });
  }

  async getLatestCoverLetter(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    return this.prisma.coverLetter.findFirst({
      where: { resumeId: resume.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSkillGap(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    return (resume as any).skillGapResult || null;
  }

  async analyzeSkillGap(id: string, userId: string, body: { jobDescription?: string }) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');

    const prompt = prepareSkillGapInstructions({
      jobTitle: resume.jobTitle || '',
      jobDescription: body.jobDescription || resume.jobDescription || '',
      resumeText: resume.textContent || '',
      feedback: resume.feedback as any,
    });

    return withAiGateway('ResumesService.analyzeSkillGap', async () => {
      const aiResponse = await this.aiService.chat([
        { role: 'system', content: 'You are a career coach analyzing skill gaps. Return ONLY a valid JSON object.' },
        { role: 'user', content: prompt },
      ]);

      const result = this.aiService.parseAIResponse(this.aiService.getResponseText(aiResponse));
      await this.prisma.resume.update({
        where: { id },
        data: { skillGapResult: result as any },
      });

      return result;
    });
  }

  async getInterviewQuestions(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    return (resume as any).interviewQuestionsResult || null;
  }

  async generateInterviewQuestions(
    id: string,
    userId: string,
    body: { jobDescription?: string; questionCount?: number; focusAreas?: string },
  ) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');

    const prompt = prepareInterviewQuestionsInstructions({
      jobTitle: resume.jobTitle || '',
      jobDescription: body.jobDescription || resume.jobDescription || '',
      resumeText: resume.textContent || '',
      feedback: resume.feedback as any,
      questionCount: body.questionCount || 10,
      focusAreas: body.focusAreas,
    });

    return withAiGateway('ResumesService.generateInterviewQuestions', async () => {
      const aiResponse = await this.aiService.chat([
        { role: 'system', content: 'You are an interview coach. Return ONLY a valid JSON object.' },
        { role: 'user', content: prompt },
      ]);

      const result = this.aiService.parseAIResponse(this.aiService.getResponseText(aiResponse));
      await this.prisma.resume.update({
        where: { id },
        data: { interviewQuestionsResult: result as any },
      });

      return result;
    });
  }

  async getSalaryEstimate(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    return (resume as any).salaryEstimateResult || null;
  }

  async estimateSalary(
    id: string,
    userId: string,
    body: { targetLocation?: string; yearsOfExperience?: string; targetIndustry?: string },
  ) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');

    const prompt = prepareSalaryEstimationInstructions({
      jobTitle: resume.jobTitle || '',
      jobDescription: resume.jobDescription || '',
      resumeText: resume.textContent || '',
      feedback: resume.feedback as any,
      targetLocation: body.targetLocation,
      yearsOfExperience: body.yearsOfExperience,
      targetIndustry: body.targetIndustry,
    });

    return withAiGateway('ResumesService.estimateSalary', async () => {
      const aiResponse = await this.aiService.chat([
        { role: 'system', content: 'You are a salary estimation expert. Return ONLY a valid JSON object.' },
        { role: 'user', content: prompt },
      ]);

      const result = this.aiService.parseAIResponse(this.aiService.getResponseText(aiResponse));
      await this.prisma.resume.update({
        where: { id },
        data: { salaryEstimateResult: result as any },
      });

      return result;
    });
  }

  async getTemplateSuggestions(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    return (resume as any).templateSuggestionsResult || null;
  }

  async suggestTemplates(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');

    const prompt = prepareTemplateSuggestionsInstructions({
      jobTitle: resume.jobTitle || '',
      jobDescription: resume.jobDescription || '',
      resumeText: resume.textContent || '',
      feedback: resume.feedback as any,
    });

    return withAiGateway('ResumesService.suggestTemplates', async () => {
      const aiResponse = await this.aiService.chat([
        { role: 'system', content: 'You are a resume template expert. Return ONLY a valid JSON object.' },
        { role: 'user', content: prompt },
      ]);

      const result = this.aiService.parseAIResponse(this.aiService.getResponseText(aiResponse));
      await this.prisma.resume.update({
        where: { id },
        data: { templateSuggestionsResult: result as any },
      });

      return result;
    });
  }

  async getMultiJd(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    return (resume as any).multiJdResult || null;
  }

  async compareMultipleJds(
    id: string,
    userId: string,
    body: { jobEntries: { title: string; description: string }[] },
  ) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');

    const prompt = prepareMultiJdInstructions({
      baseJobTitle: resume.jobTitle || '',
      resumeText: resume.textContent || '',
      feedback: resume.feedback as any,
      jobEntries: body.jobEntries,
    });

    return withAiGateway('ResumesService.compareMultipleJds', async () => {
      const aiResponse = await this.aiService.chat([
        { role: 'system', content: 'You are a career strategist comparing job descriptions. Return ONLY a valid JSON object.' },
        { role: 'user', content: prompt },
      ]);

      const result = this.aiService.parseAIResponse(this.aiService.getResponseText(aiResponse));
      await this.prisma.resume.update({
        where: { id },
        data: { multiJdResult: result as any },
      });

      return result;
    });
  }

  async generateShareToken(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    const token = Math.random().toString(36).substring(2, 15);
    await this.prisma.resume.update({
      where: { id },
      data: { shareToken: token },
    });
    return { token };
  }

  async getTipFeedback(id: string, userId: string) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    return (resume as any).tipFeedback || {};
  }

  async saveTipFeedback(
    id: string,
    userId: string,
    key: string,
    value: 'up' | 'down' | null,
  ) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    const current = ((resume as any).tipFeedback as Record<string, 'up' | 'down'>) || {};
    if (value === null) delete current[key];
    else current[key] = value;
    await this.prisma.resume.update({
      where: { id },
      data: { tipFeedback: current },
    });
    return current;
  }

  async generateTailoredResume(
    id: string,
    userId: string,
    body: { jobDescription: string; targetRole?: string; jobId?: string },
  ) {
    const resume = await this.findById(id, userId);
    if (!resume || !resume.textContent) {
      throw new Error('No resume text content available');
    }

    const prompt = prepareTailoredResumeInstructions({
      baseResumeText: resume.textContent || '',
      jobTitle: body.targetRole || resume.jobTitle || '',
      companyName: resume.companyName || 'Target Company',
      jobDescription: body.jobDescription,
      atsFeedback: JSON.stringify(resume.feedback || {}),
    });

    // Hard-fail AI path (chat → parse → persist): generation failure must
    // surface as 502 with the shared client-safe message. The trailing ATS
    // analysis below stays best-effort on purpose.
    const { result, newResume } = await withAiGateway(
      'ResumesService.generateTailoredResume',
      async () => {
        const aiResponse = await this.aiService.chat([
          { role: 'user', content: prompt },
        ]);

        const parsed: any = this.aiService.parseAIResponse(
          this.aiService.getResponseText(aiResponse),
        );

        // Create a NEW resume record for the tailored version
        const tailoredResumeContent = parsed.tailoredResume;
        const textContent = this.formatTailoredResumeToText(tailoredResumeContent, body.targetRole || resume.jobTitle || 'Resume');

        const created = await this.prisma.resume.create({
          data: {
            user: { connect: { id: userId } },
            companyName: resume.companyName,
            jobTitle: body.targetRole || resume.jobTitle || '',
            jobDescription: body.jobDescription,
            fileName: `tailored-${body.targetRole || 'resume'}-${Date.now()}.txt`,
            format: 'txt',
            filePath: '',
            textPreview: textContent.substring(0, 500),
            textContent: textContent,
            generatedContent: tailoredResumeContent as any,
            feedback: {},
            tailoredResumeResult: Object.assign({}, parsed, { jobId: body.jobId || null }) as any,
          },
        });

        return { result: parsed, newResume: created };
      },
    );

    // Run ATS analysis on the new tailored resume
    try {
      const instructions = prepareInstructions({ jobTitle: body.targetRole || resume.jobTitle || 'Resume', jobDescription: body.jobDescription || '' });
      const analysis = await this.aiService.chat([
        { role: 'system', content: ANALYSIS_SYSTEM_MESSAGE },
        { role: 'user', content: instructions },
      ]);
      const parsed = this.aiService.parseAIResponse(this.aiService.getResponseText(analysis));
      if (parsed) {
        await this.prisma.resume.update({
          where: { id: newResume.id },
          data: { feedback: parsed },
        });
      }
    } catch (e) {
      console.error('Failed to analyze tailored resume:', e);
    }

    return { ...result, newResumeId: newResume.id };
  }

  private formatTailoredResumeToText(resume: any, targetRole?: string): string {
    const sections: string[] = [];

    if (resume.summary) {
      sections.push('PROFESSIONAL SUMMARY', resume.summary, '');
    }

    if (resume.experience?.length) {
      sections.push('EXPERIENCE');
      for (const exp of resume.experience) {
        sections.push(`${exp.title} | ${exp.company}${exp.location ? ` | ${exp.location}` : ''} | ${exp.startDate} - ${exp.endDate}`);
        for (const bullet of exp.bullets || []) {
          sections.push(`• ${bullet}`);
        }
        sections.push('');
      }
    }

    if (resume.education?.length) {
      sections.push('EDUCATION');
      for (const edu of resume.education) {
        sections.push(`${edu.degree}${edu.field ? ` in ${edu.field}` : ''} | ${edu.school}${edu.location ? `, ${edu.location}` : ''} | ${edu.graduationDate}`);
        if (edu.details?.length) {
          for (const detail of edu.details) sections.push(`• ${detail}`);
        }
        sections.push('');
      }
    }

    if (resume.skills?.length) {
      sections.push('SKILLS', resume.skills.join(', '), '');
    }

    if (resume.projects?.length) {
      sections.push('PROJECTS');
      for (const proj of resume.projects) {
        sections.push(`${proj.name} | ${proj.technologies?.join(', ') || ''}`);
        sections.push(proj.description);
        for (const bullet of proj.bullets || []) {
          sections.push(`• ${bullet}`);
        }
        sections.push('');
      }
    }

    if (resume.certifications?.length) {
      sections.push('CERTIFICATIONS', resume.certifications.join(', '), '');
    }

    return sections.join('\n').trim();
  }

  async getTailoredResume(id: string, userId: string, jobId?: string) {
    const resume = await this.findById(id, userId);
    if (!resume) return null;
    const result = resume.tailoredResumeResult as any;
    if (!result || !result.tailoredResume) return null;
    if (jobId) {
      if (result.jobId !== jobId) return null;
    }
    return result;
  }

  async createResumeVersion(
    resumeId: string,
    userId: string,
    body: { name: string; description?: string; content: any; isPrimary?: boolean },
  ) {
    const resume = await this.findById(resumeId, userId);

    if (body.isPrimary) {
      await this.prisma.resumeVersion.updateMany({
        where: { resumeId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.resumeVersion.create({
      data: {
        resumeId,
        name: body.name,
        roleType: body.description || 'general',
        content: body.content,
        isPrimary: body.isPrimary || false,
      },
    });
  }

  async getResumeVersions(resumeId: string, userId: string) {
    await this.findById(resumeId, userId);
    return this.prisma.resumeVersion.findMany({
      where: { resumeId },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getResumeVersion(versionId: string, userId: string) {
    const version = await this.prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true },
    });
    if (!version || version.resume.userId !== userId) {
      throw new NotFoundException('Resume version not found');
    }
    return version;
  }

  async updateResumeVersion(
    versionId: string,
    userId: string,
    body: { name?: string; roleType?: string; description?: string; content?: any; isPrimary?: boolean },
  ) {
    const version = await this.prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true },
    });
    if (!version || version.resume.userId !== userId) {
      throw new NotFoundException('Resume version not found');
    }

    if (body.isPrimary) {
      await this.prisma.resumeVersion.updateMany({
        where: { resumeId: version.resumeId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    // The client sends roleType (ResumeVersionUpdateRequest); `description`
    // is kept as a legacy alias so older callers keep working.
    const roleType = body.roleType ?? body.description;
    if (roleType !== undefined) updateData.roleType = roleType;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.isPrimary !== undefined) updateData.isPrimary = body.isPrimary;

    return this.prisma.resumeVersion.update({
      where: { id: versionId },
      data: updateData,
    });
  }

  async deleteResumeVersion(versionId: string, userId: string) {
    const version = await this.prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true },
    });
    if (!version || version.resume.userId !== userId) {
      throw new NotFoundException('Resume version not found');
    }
    await this.prisma.resumeVersion.delete({ where: { id: versionId } });
    return { message: 'Version deleted' };
  }

  async setPrimaryResumeVersion(versionId: string, userId: string) {
    const version = await this.prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true },
    });
    if (!version || version.resume.userId !== userId) {
      throw new NotFoundException('Resume version not found');
    }

    await this.prisma.resumeVersion.updateMany({
      where: { resumeId: version.resumeId, isPrimary: true },
      data: { isPrimary: false },
    });

    await this.prisma.resumeVersion.update({
      where: { id: versionId },
      data: { isPrimary: true },
    });

    return this.prisma.resumeVersion.findUnique({ where: { id: versionId } });
  }

  async updateApplicationStatus(
    id: string,
    userId: string,
    body: { status: string; notes?: string },
  ) {
    const resume = await this.findById(id, userId);
    if (!resume) throw new NotFoundException('Resume not found');
    return this.prisma.resume.update({
      where: { id },
      data: {
        applicationStatus: body.status,
        applicationNotes: body.notes,
      },
    });
  }

  async getReportByToken(token: string) {
    return this.prisma.resume.findFirst({
      where: { shareToken: token },
      select: {
        id: true,
        companyName: true,
        jobTitle: true,
        fileName: true,
        format: true,
        imagePath: true,
        feedback: true,
        generatedContent: true,
        textContent: true,
        sharedFeedbacks: true,
        createdAt: true,
      },
    });
  }

  async submitSharedFeedback(token: string, body: { name: string; comment: string; rating?: number }) {
    const resume = await this.prisma.resume.findFirst({ where: { shareToken: token } });
    if (!resume) throw new NotFoundException('Resume not found');

    const existing = (resume.sharedFeedbacks as any[]) || [];
    const feedback = {
      id: crypto.randomUUID(),
      name: body.name,
      comment: body.comment,
      rating: body.rating ?? null,
      createdAt: new Date().toISOString(),
    };
    const updated = [...existing, feedback];

    await this.prisma.resume.update({
      where: { id: resume.id },
      data: { sharedFeedbacks: updated },
    });

    return feedback;
  }
}
