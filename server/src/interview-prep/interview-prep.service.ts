import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { withAiGateway } from '../common/ai-gateway';
import {
  prepareCompanyBriefingInstructions,
  prepareTechnicalAssessmentInstructions,
  prepareBehavioralBankInstructions,
  prepareCheatSheetInstructions,
  prepareMockInterviewerInstructions,
  prepareMockInterviewFeedback,
} from './prompts';
import type {
  CompanyBriefing,
  TechnicalAssessment,
  BehavioralQuestionBank,
  MockInterviewSession,
  MockInterviewMessage,
  InterviewCheatSheet,
  InterviewScheduleEntry,
} from '../common/types';

@Injectable()
export class InterviewPrepService {
  private readonly logger = new Logger(InterviewPrepService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async generateCompanyBriefing(
    userId: string,
    body: {
      companyName: string;
      roleTitle: string;
      jobDescription?: string;
      resumeText?: string;
      companyContext?: string;
    },
  ) {
    const prompt = prepareCompanyBriefingInstructions({
      companyName: body.companyName,
      jobTitle: body.roleTitle,
      jobDescription: body.jobDescription || '',
      resumeText: body.resumeText || '',
      companyContext: body.companyContext,
    });

    const result = await withAiGateway('InterviewPrepService.generateCompanyBriefing', async () => {
      const aiResponse = await this.aiService.chat([{ role: 'user', content: prompt }]);
      return this.aiService.parseAIResponse<CompanyBriefing>(
        this.aiService.getResponseText(aiResponse),
      );
    });

    // Save to database
    const prep = await this.prisma.interviewPrep.create({
      data: {
        userId,
        type: 'company_briefing',
        companyName: body.companyName,
        roleTitle: body.roleTitle,
        data: result as any,
      },
    });

    return { id: prep.id, ...result };
  }

  async getCompanyBriefings(userId: string) {
    return this.prisma.interviewPrep.findMany({
      where: { userId, type: 'company_briefing' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyName: true,
        roleTitle: true,
        createdAt: true,
      },
    });
  }

  async getCompanyBriefing(userId: string, id: string) {
    const prep = await this.prisma.interviewPrep.findFirst({
      where: { id, userId, type: 'company_briefing' },
    });
    if (!prep) throw new NotFoundException('Company briefing not found');
    return { id: prep.id, ...(prep.data as unknown as CompanyBriefing) };
  }

  async deleteCompanyBriefing(userId: string, id: string) {
    const prep = await this.prisma.interviewPrep.findFirst({
      where: { id, userId, type: 'company_briefing' },
    });
    if (!prep) throw new NotFoundException('Company briefing not found');
    await this.prisma.interviewPrep.delete({ where: { id } });
  }

  async generateTechnicalAssessment(
    userId: string,
    body: {
      roleTitle: string;
      jobDescription?: string;
      resumeText?: string;
      targetDifficulty?: string;
      focusAreas?: string;
      applicationId?: string;
    },
  ) {
    const prompt = prepareTechnicalAssessmentInstructions({
      jobTitle: body.roleTitle,
      jobDescription: body.jobDescription || '',
      resumeText: body.resumeText || '',
      targetDifficulty: body.targetDifficulty,
      focusAreas: body.focusAreas,
    });

    const result = await withAiGateway('InterviewPrepService', async () => {
      const aiResponse = await this.aiService.chat([{ role: 'user', content: prompt }]);
      return this.aiService.parseAIResponse(
        this.aiService.getResponseText(aiResponse),
      );
    });

    const practice = await this.prisma.technicalPractice.create({
      data: {
        userId,
        applicationId: body.applicationId || null,
        roleTitle: body.roleTitle,
        difficulty: (result as TechnicalAssessment).difficulty || 'mid',
        data: result as any,
      },
    });

    return { id: practice.id, ...(result as TechnicalAssessment) };
  }

  async getTechnicalPractices(userId: string) {
    return this.prisma.technicalPractice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        roleTitle: true,
        difficulty: true,
        createdAt: true,
      },
    });
  }

  async getTechnicalPractice(userId: string, id: string) {
    const practice = await this.prisma.technicalPractice.findFirst({
      where: { id, userId },
    });
    if (!practice) throw new NotFoundException('Technical practice not found');
    return { id: practice.id, ...(practice.data as unknown as TechnicalAssessment) };
  }

  async deleteTechnicalPractice(userId: string, id: string) {
    const practice = await this.prisma.technicalPractice.findFirst({
      where: { id, userId },
    });
    if (!practice) throw new NotFoundException('Technical practice not found');
    await this.prisma.technicalPractice.delete({ where: { id } });
  }

  async generateBehavioralBank(
    userId: string,
    body: {
      roleTitle: string;
      jobDescription?: string;
      resumeText?: string;
      competencies?: string;
      questionCount?: number;
      applicationId?: string;
    },
  ) {
    const prompt = prepareBehavioralBankInstructions({
      jobTitle: body.roleTitle,
      jobDescription: body.jobDescription || '',
      resumeText: body.resumeText || '',
      competencies: body.competencies,
      questionCount: body.questionCount,
    });

    const result = await withAiGateway('InterviewPrepService', async () => {
      const aiResponse = await this.aiService.chat([{ role: 'user', content: prompt }]);
      return this.aiService.parseAIResponse(
        this.aiService.getResponseText(aiResponse),
      );
    });

    const bank = await this.prisma.behavioralBank.create({
      data: {
        userId,
        applicationId: body.applicationId || null,
        roleTitle: body.roleTitle,
        competencies: (result as BehavioralQuestionBank).competencies || [],
        questions: ((result as BehavioralQuestionBank).questions || []) as any,
        preparationTips: (result as BehavioralQuestionBank).preparationTips || [],
        summary: (result as BehavioralQuestionBank).summary || '',
      },
    });

    return { id: bank.id, ...(result as BehavioralQuestionBank) };
  }

  async getBehavioralBanks(userId: string) {
    return this.prisma.behavioralBank.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        roleTitle: true,
        competencies: true,
        createdAt: true,
      },
    });
  }

  async getBehavioralBank(userId: string, id: string) {
    const bank = await this.prisma.behavioralBank.findFirst({
      where: { id, userId },
    });
    if (!bank) throw new NotFoundException('Behavioral bank not found');
    return {
      id: bank.id,
      roleTitle: bank.roleTitle,
      competencies: bank.competencies,
      questions: bank.questions,
      preparationTips: bank.preparationTips,
      summary: bank.summary,
    };
  }

  async deleteBehavioralBank(userId: string, id: string) {
    const bank = await this.prisma.behavioralBank.findFirst({
      where: { id, userId },
    });
    if (!bank) throw new NotFoundException('Behavioral bank not found');
    await this.prisma.behavioralBank.delete({ where: { id } });
  }

  // Mock Interview Simulator
  async createMockInterview(
    userId: string,
    body: {
      roleTitle: string;
      company?: string;
      jobDescription?: string;
      resumeText?: string;
      applicationId?: string;
    },
  ) {
    const session = await this.prisma.mockInterviewSession.create({
      data: {
        userId,
        applicationId: body.applicationId || null,
        roleTitle: body.roleTitle,
        company: body.company || null,
        messages: [],
        status: 'in_progress',
        totalQuestions: 0,
      },
    });

    // Generate first interviewer message (introduction + warm-up question)
    const firstMessage = await this.generateInterviewerMessage(
      body.roleTitle,
      body.company,
      body.resumeText || '',
      body.jobDescription || '',
      '',
      1,
    );

    const messages = [{
      role: 'interviewer' as const,
      content: firstMessage.message,
      timestamp: new Date().toISOString(),
    }];

    await this.prisma.mockInterviewSession.update({
      where: { id: session.id },
      data: {
        messages: messages as any,
        totalQuestions: 1,
        topicsCovered: firstMessage.suggestedTopics || [],
      },
    });

    return {
      id: session.id,
      roleTitle: body.roleTitle,
      company: body.company,
      messages,
      status: 'in_progress',
      totalQuestions: 1,
    };
  }

  async sendMockInterviewMessage(
    userId: string,
    sessionId: string,
    message: string,
  ) {
    const session = await this.prisma.mockInterviewSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Mock interview session not found');
    if (session.status !== 'in_progress') throw new Error('Interview session is already completed');

    const existingMessages = (session.messages as any as MockInterviewMessage[]) || [];
    const candidateMessage = {
      role: 'candidate' as const,
      content: message,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...existingMessages, candidateMessage];

    // Generate interviewer response
    const questionNumber = (session.totalQuestions || 0) + 1;
    const conversationHistory = updatedMessages
      .map(m => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
      .join('\n\n');

    const interviewerResponse = await this.generateInterviewerMessage(
      session.roleTitle,
      session.company || undefined,
      '', // resumeText not stored in session
      '', // jobDescription not stored in session
      conversationHistory,
      questionNumber,
    );

    const interviewerMessage = {
      role: 'interviewer' as const,
      content: interviewerResponse.message,
      timestamp: new Date().toISOString(),
    };

    const finalMessages = [...updatedMessages, interviewerMessage];
    const isComplete = interviewerResponse.isComplete || questionNumber >= 12;

    const updateData: any = {
      messages: finalMessages,
      totalQuestions: questionNumber,
    };

    if (isComplete) {
      updateData.status = 'completed';
      // Generate overall feedback
      const feedback = await this.generateMockInterviewFeedback(
        session.roleTitle,
        session.company || undefined,
        finalMessages,
      );
      updateData.overallFeedback = feedback;
    }

    await this.prisma.mockInterviewSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return {
      message: interviewerMessage,
      isComplete,
      questionNumber,
    };
  }

  async getMockInterview(userId: string, sessionId: string) {
    const session = await this.prisma.mockInterviewSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Mock interview session not found');
    return session;
  }

  async getMockInterviews(userId: string) {
    return this.prisma.mockInterviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        roleTitle: true,
        company: true,
        status: true,
        totalQuestions: true,
        createdAt: true,
      },
    });
  }

  async deleteMockInterview(userId: string, sessionId: string) {
    const session = await this.prisma.mockInterviewSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Mock interview session not found');
    await this.prisma.mockInterviewSession.delete({ where: { id: sessionId } });
  }

  // Cheat Sheet
  async generateCheatSheet(
    userId: string,
    body: {
      companyName: string;
      roleTitle: string;
      jobDescription?: string;
      resumeText?: string;
      companyContext?: string;
      salaryContext?: string;
      applicationId?: string;
    },
  ) {
    const prompt = prepareCheatSheetInstructions({
      companyName: body.companyName,
      jobTitle: body.roleTitle,
      jobDescription: body.jobDescription || '',
      resumeText: body.resumeText || '',
      companyContext: body.companyContext,
      salaryContext: body.salaryContext,
    });

    const result = await withAiGateway('InterviewPrepService', async () => {
      const aiResponse = await this.aiService.chat([{ role: 'user', content: prompt }]);
      return this.aiService.parseAIResponse(
        this.aiService.getResponseText(aiResponse),
      );
    });

    const prep = await this.prisma.interviewPrep.create({
      data: {
        userId,
        type: 'cheat_sheet',
        applicationId: body.applicationId || null,
        companyName: body.companyName,
        roleTitle: body.roleTitle,
        data: result as any,
      },
    });

    return { id: prep.id, ...(result as unknown as InterviewCheatSheet) };
  }

  async getCheatSheets(userId: string) {
    return this.prisma.interviewPrep.findMany({
      where: { userId, type: 'cheat_sheet' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyName: true,
        roleTitle: true,
        createdAt: true,
      },
    });
  }

  async getCheatSheet(userId: string, id: string) {
    const prep = await this.prisma.interviewPrep.findFirst({
      where: { id, userId, type: 'cheat_sheet' },
    });
    if (!prep) throw new NotFoundException('Cheat sheet not found');
    return { id: prep.id, ...(prep.data as unknown as InterviewCheatSheet) };
  }

  async deleteCheatSheet(userId: string, id: string) {
    const prep = await this.prisma.interviewPrep.findFirst({
      where: { id, userId, type: 'cheat_sheet' },
    });
    if (!prep) throw new NotFoundException('Cheat sheet not found');
    await this.prisma.interviewPrep.delete({ where: { id } });
  }

  // Interview Scheduling
  async createScheduleEntry(
    userId: string,
    body: {
      applicationId?: string;
      companyName: string;
      roleTitle: string;
      interviewType: string;
      scheduledAt: string;
      duration: number;
      timezone?: string;
      location?: string;
      meetingLink?: string;
      interviewerNames?: string[];
      prepTimeBlock?: number;
      notes?: string;
    },
  ) {
    return this.prisma.interviewSchedule.create({
      data: {
        userId,
        applicationId: body.applicationId || null,
        companyName: body.companyName,
        roleTitle: body.roleTitle,
        interviewType: body.interviewType,
        scheduledAt: new Date(body.scheduledAt),
        duration: body.duration,
        timezone: body.timezone || 'UTC',
        location: body.location || null,
        meetingLink: body.meetingLink || null,
        interviewerNames: body.interviewerNames || [],
        prepTimeBlock: body.prepTimeBlock || null,
        notes: body.notes || null,
        status: 'scheduled',
        reminders: [
          { type: 'email', minutesBefore: 1440, sent: false },
          { type: 'email', minutesBefore: 60, sent: false },
        ],
      },
    });
  }

  async getScheduleEntries(userId: string, filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = { userId };
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      where.scheduledAt = {};
      if (filters.startDate) where.scheduledAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.scheduledAt.lte = new Date(filters.endDate);
    }

    return this.prisma.interviewSchedule.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getScheduleEntry(userId: string, id: string) {
    const entry = await this.prisma.interviewSchedule.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException('Schedule entry not found');
    return entry;
  }

  async updateScheduleEntry(
    userId: string,
    id: string,
    body: Partial<{
      interviewType: string;
      scheduledAt: string;
      duration: number;
      timezone: string;
      location: string;
      meetingLink: string;
      interviewerNames: string[];
      prepTimeBlock: number;
      notes: string;
      status: string;
    }>,
  ) {
    const existing = await this.prisma.interviewSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Schedule entry not found');

    const updateData: any = { ...body };
    if (body.scheduledAt) updateData.scheduledAt = new Date(body.scheduledAt);

    return this.prisma.interviewSchedule.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteScheduleEntry(userId: string, id: string) {
    const existing = await this.prisma.interviewSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Schedule entry not found');
    await this.prisma.interviewSchedule.delete({ where: { id } });
  }

  async getUpcomingInterviews(userId: string) {
    return this.prisma.interviewSchedule.findMany({
      where: {
        userId,
        status: 'scheduled',
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });
  }

  // Private helpers
  private async generateInterviewerMessage(
    roleTitle: string,
    company: string | undefined,
    resumeText: string,
    jobDescription: string,
    conversationHistory: string,
    questionNumber: number,
  ): Promise<{ message: string; isComplete: boolean; suggestedTopics?: string[] }> {
    const prompt = prepareMockInterviewerInstructions({
      roleTitle,
      company,
      resumeText,
      jobDescription,
      conversationHistory,
      questionNumber,
    });

    return withAiGateway('InterviewPrepService.mockInterviewerTurn', async () => {
      const aiResponse = await this.aiService.chat([{ role: 'user', content: prompt }]);
      const result = this.aiService.parseAIResponse<any>(
        this.aiService.getResponseText(aiResponse),
      );

      return {
        message: result.message || 'Could you tell me more about that?',
        isComplete: result.isComplete || false,
        suggestedTopics: result.suggestedTopics,
      };
    });
  }

  private async generateMockInterviewFeedback(
    roleTitle: string,
    company: string | undefined,
    messages: any[],
  ): Promise<any> {
    const transcript = messages
      .map(m => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
      .join('\n\n');

    const prompt = prepareMockInterviewFeedback({
      roleTitle,
      company,
      messages: transcript,
    });

    return withAiGateway('InterviewPrepService.mockInterviewFeedback', async () => {
      const aiResponse = await this.aiService.chat([{ role: 'user', content: prompt }]);
      return this.aiService.parseAIResponse<any>(
        this.aiService.getResponseText(aiResponse),
      );
    });
  }
}
