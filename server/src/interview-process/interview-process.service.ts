import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { Prisma } from '@prisma/client';
import { withAiGateway } from '../common/ai-gateway';

@Injectable()
export class InterviewProcessService {
  private readonly logger = new Logger(InterviewProcessService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  // ─── Interview Notes & Rating ───

  async createNote(userId: string, data: {
    applicationId?: string;
    scheduleId?: string;
    companyName: string;
    roleTitle: string;
    interviewType: string;
    roundNumber?: number;
    questionsAsked: any[];
    selfRating: number;
    strengths?: string[];
    weaknesses?: string[];
    followUpItems?: string[];
    generalNotes?: string;
    interviewDate: string;
  }) {
    return this.prisma.interviewNote.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        scheduleId: data.scheduleId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        interviewType: data.interviewType,
        roundNumber: data.roundNumber || 1,
        questionsAsked: data.questionsAsked || [],
        selfRating: data.selfRating,
        strengths: data.strengths || [],
        weaknesses: data.weaknesses || [],
        followUpItems: data.followUpItems || [],
        generalNotes: data.generalNotes || null,
        interviewDate: new Date(data.interviewDate),
      },
      include: { feedbacks: true, followUpEmails: true },
    });
  }

  async listNotes(userId: string, filters?: { companyName?: string; interviewType?: string }) {
    const where: Prisma.InterviewNoteWhereInput = { userId };
    if (filters?.companyName) {
      where.companyName = { contains: filters.companyName, mode: 'insensitive' };
    }
    if (filters?.interviewType) {
      where.interviewType = filters.interviewType;
    }
    return this.prisma.interviewNote.findMany({
      where,
      orderBy: { interviewDate: 'desc' },
      include: { feedbacks: true },
    });
  }

  async getNote(userId: string, id: string) {
    const note = await this.prisma.interviewNote.findFirst({
      where: { id, userId },
      include: { feedbacks: true, followUpEmails: true },
    });
    if (!note) throw new NotFoundException('Interview note not found');
    return note;
  }

  async updateNote(userId: string, id: string, data: {
    questionsAsked?: any[];
    selfRating?: number;
    strengths?: string[];
    weaknesses?: string[];
    followUpItems?: string[];
    generalNotes?: string;
  }) {
    const existing = await this.prisma.interviewNote.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Interview note not found');
    return this.prisma.interviewNote.update({
      where: { id },
      data,
      include: { feedbacks: true, followUpEmails: true },
    });
  }

  async deleteNote(userId: string, id: string) {
    const existing = await this.prisma.interviewNote.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Interview note not found');
    await this.prisma.interviewNote.delete({ where: { id } });
  }

  // ─── Interviewer Feedback Tracker ───

  async addFeedback(userId: string, interviewNoteId: string, data: {
    interviewerName: string;
    interviewerRole?: string;
    rating: number;
    feedbackText: string;
    recommendation: string;
    strengths?: string[];
    concerns?: string[];
    sharedAt?: string;
  }) {
    const note = await this.prisma.interviewNote.findFirst({ where: { id: interviewNoteId, userId } });
    if (!note) throw new NotFoundException('Interview note not found');

    return this.prisma.interviewerFeedback.create({
      data: {
        userId,
        interviewNoteId,
        interviewerName: data.interviewerName,
        interviewerRole: data.interviewerRole || null,
        rating: data.rating,
        feedbackText: data.feedbackText,
        recommendation: data.recommendation,
        strengths: data.strengths || [],
        concerns: data.concerns || [],
        sharedAt: data.sharedAt ? new Date(data.sharedAt) : null,
      },
    });
  }

  async listFeedbacks(userId: string, interviewNoteId: string) {
    const note = await this.prisma.interviewNote.findFirst({ where: { id: interviewNoteId, userId } });
    if (!note) throw new NotFoundException('Interview note not found');

    return this.prisma.interviewerFeedback.findMany({
      where: { interviewNoteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateFeedback(userId: string, id: string, data: {
    rating?: number;
    feedbackText?: string;
    recommendation?: string;
    strengths?: string[];
    concerns?: string[];
  }) {
    const existing = await this.prisma.interviewerFeedback.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Feedback not found');
    return this.prisma.interviewerFeedback.update({ where: { id }, data });
  }

  async deleteFeedback(userId: string, id: string) {
    const existing = await this.prisma.interviewerFeedback.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Feedback not found');
    await this.prisma.interviewerFeedback.delete({ where: { id } });
  }

  // ─── Follow-up Email Templates ───

  async createFollowUpEmail(userId: string, data: {
    applicationId?: string;
    interviewNoteId?: string;
    type: string;
    subject: string;
    body: string;
  }) {
    return this.prisma.followUpEmail.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        interviewNoteId: data.interviewNoteId || null,
        type: data.type,
        subject: data.subject,
        body: data.body,
      },
    });
  }

  async listFollowUpEmails(userId: string, filters?: { type?: string; interviewNoteId?: string }) {
    const where: Prisma.FollowUpEmailWhereInput = { userId };
    if (filters?.type) where.type = filters.type;
    if (filters?.interviewNoteId) where.interviewNoteId = filters.interviewNoteId;
    return this.prisma.followUpEmail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFollowUpEmail(userId: string, id: string) {
    const email = await this.prisma.followUpEmail.findFirst({ where: { id, userId } });
    if (!email) throw new NotFoundException('Follow-up email not found');
    return email;
  }

  async updateFollowUpEmail(userId: string, id: string, data: {
    subject?: string;
    body?: string;
    sentAt?: string;
  }) {
    const existing = await this.prisma.followUpEmail.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Follow-up email not found');
    return this.prisma.followUpEmail.update({
      where: { id },
      data: {
        ...data,
        sentAt: data.sentAt ? new Date(data.sentAt) : undefined,
      },
    });
  }

  async deleteFollowUpEmail(userId: string, id: string) {
    const existing = await this.prisma.followUpEmail.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Follow-up email not found');
    await this.prisma.followUpEmail.delete({ where: { id } });
  }

  async generateFollowUpEmail(userId: string, body: {
    interviewNoteId?: string;
    type: string;
    companyName: string;
    roleTitle: string;
    interviewerName?: string;
    additionalContext?: string;
  }) {
    const prompts: Record<string, string> = {
      thank_you: `Generate a professional thank-you email after a ${body.roleTitle} interview at ${body.companyName}${body.interviewerName ? ` with ${body.interviewerName}` : ''}. Include specific gratitude, a brief mention of a key discussion point, and reiterate enthusiasm. Keep it concise and professional.`,
      check_in: `Generate a professional check-in/follow-up email for a ${body.roleTitle} position at ${body.companyName}. It's been about a week since the interview. Be polite, express continued interest, and gently ask about next steps.`,
      additional_materials: `Generate a professional email sending additional materials for a ${body.roleTitle} position at ${body.companyName}. Reference something discussed in the interview and provide supplementary information.`,
      custom: `Generate a professional follow-up email for a ${body.roleTitle} position at ${body.companyName}. ${body.additionalContext || ''}`,
    };

    const prompt = prompts[body.type] || prompts.custom;
    const text = await withAiGateway('InterviewProcessService.generateFollowUpEmail', async () => {
      const response = await this.aiService.chat(prompt, { temperature: 0.3 });
      return this.aiService.getResponseText(response);
    });

    return {
      type: body.type,
      subject: `Follow-up: ${body.roleTitle} at ${body.companyName}`,
      body: text,
    };
  }

  // ─── Panel Interview Coordinator ───

  async createPanelInterview(userId: string, data: {
    applicationId?: string;
    companyName: string;
    roleTitle: string;
    scheduledAt: string;
    duration: number;
    location?: string;
    meetingLink?: string;
    interviewers: { name: string; role?: string; email?: string }[];
    notes?: string;
  }) {
    return this.prisma.panelInterview.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        scheduledAt: new Date(data.scheduledAt),
        duration: data.duration,
        location: data.location || null,
        meetingLink: data.meetingLink || null,
        interviewers: data.interviewers || [],
        notes: data.notes || null,
      },
    });
  }

  async listPanelInterviews(userId: string, filters?: { status?: string }) {
    const where: Prisma.PanelInterviewWhereInput = { userId };
    if (filters?.status) where.status = filters.status;
    return this.prisma.panelInterview.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getPanelInterview(userId: string, id: string) {
    const panel = await this.prisma.panelInterview.findFirst({ where: { id, userId } });
    if (!panel) throw new NotFoundException('Panel interview not found');
    return panel;
  }

  async updatePanelInterview(userId: string, id: string, data: {
    scheduledAt?: string;
    duration?: number;
    location?: string;
    meetingLink?: string;
    interviewers?: { name: string; role?: string; email?: string }[];
    status?: string;
    notes?: string;
  }) {
    const existing = await this.prisma.panelInterview.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Panel interview not found');
    return this.prisma.panelInterview.update({
      where: { id },
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    });
  }

  async deletePanelInterview(userId: string, id: string) {
    const existing = await this.prisma.panelInterview.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Panel interview not found');
    await this.prisma.panelInterview.delete({ where: { id } });
  }

  // ─── Case Study / Presentation Builder ───

  async createCaseStudy(userId: string, data: {
    applicationId?: string;
    companyName: string;
    roleTitle: string;
    title: string;
    description?: string;
    slides?: any[];
  }) {
    return this.prisma.caseStudy.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        title: data.title,
        description: data.description || null,
        slides: data.slides || [],
        aiAssisted: false,
      },
    });
  }

  async listCaseStudies(userId: string) {
    return this.prisma.caseStudy.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCaseStudy(userId: string, id: string) {
    const cs = await this.prisma.caseStudy.findFirst({ where: { id, userId } });
    if (!cs) throw new NotFoundException('Case study not found');
    return cs;
  }

  async updateCaseStudy(userId: string, id: string, data: {
    title?: string;
    description?: string;
    slides?: any[];
  }) {
    const existing = await this.prisma.caseStudy.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Case study not found');
    return this.prisma.caseStudy.update({ where: { id }, data });
  }

  async deleteCaseStudy(userId: string, id: string) {
    const existing = await this.prisma.caseStudy.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Case study not found');
    await this.prisma.caseStudy.delete({ where: { id } });
  }

  async generateCaseStudy(userId: string, body: {
    companyName: string;
    roleTitle: string;
    title: string;
    description: string;
    slideCount?: number;
  }) {
    const slideCount = body.slideCount || 8;
    const prompt = `Generate a professional presentation/case study for a ${body.roleTitle} position at ${body.companyName}.
Title: ${body.title}
Description: ${body.description}

Create ${slideCount} slides. Return JSON with this structure:
{
  "title": "${body.title}",
  "slides": [
    {
      "title": "Slide Title",
      "content": "Bullet points or content for the slide (use \\n for line breaks)",
      "notes": "Speaker notes for this slide",
      "layout": "title" | "content" | "two-column" | "chart" | "conclusion"
    }
  ]
}

Make the content specific to the role and company. Include:
- Title slide
- Problem/Context slide
- Analysis/Approach slides (3-4)
- Solution/Recommendation slides (2-3)
- Conclusion/Q&A slide

Return ONLY valid JSON.`;

    const parsed = await withAiGateway('InterviewProcessService.generateCaseStudy', async () => {
      const response = await this.aiService.chat(prompt, {
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });
      const text = this.aiService.getResponseText(response);
      return this.aiService.parseAIResponse<{ title: string; slides: any[] }>(text);
    });

    const caseStudy = await this.prisma.caseStudy.create({
      data: {
        userId,
        companyName: body.companyName,
        roleTitle: body.roleTitle,
        title: parsed.title || body.title,
        description: body.description,
        slides: parsed.slides || [],
        aiAssisted: true,
      },
    });

    return caseStudy;
  }

  // ─── Interview Performance Analytics ───

  async getPerformanceAnalytics(userId: string) {
    const notes = await this.prisma.interviewNote.findMany({
      where: { userId },
      orderBy: { interviewDate: 'desc' },
      include: { feedbacks: true },
    });

    const total = notes.length;
    if (total === 0) {
      return {
        totalInterviews: 0,
        averageSelfRating: 0,
        byType: {},
        byCompany: {},
        ratingTrend: [],
        strengthFrequency: {},
        weaknessFrequency: {},
        feedbackSummary: null,
        recentNotes: [],
      };
    }

    // Average self-rating
    const avgRating = notes.reduce((sum, n) => sum + n.selfRating, 0) / total;

    // By interview type
    const byType: Record<string, { count: number; avgRating: number; notes: typeof notes }> = {};
    for (const note of notes) {
      if (!byType[note.interviewType]) {
        byType[note.interviewType] = { count: 0, avgRating: 0, notes: [] };
      }
      byType[note.interviewType].count++;
      byType[note.interviewType].avgRating += note.selfRating;
      byType[note.interviewType].notes.push(note);
    }
    for (const key of Object.keys(byType)) {
      byType[key].avgRating = Math.round((byType[key].avgRating / byType[key].count) * 10) / 10;
    }

    // By company
    const byCompany: Record<string, { count: number; avgRating: number; notes: typeof notes }> = {};
    for (const note of notes) {
      if (!byCompany[note.companyName]) {
        byCompany[note.companyName] = { count: 0, avgRating: 0, notes: [] };
      }
      byCompany[note.companyName].count++;
      byCompany[note.companyName].avgRating += note.selfRating;
      byCompany[note.companyName].notes.push(note);
    }
    for (const key of Object.keys(byCompany)) {
      byCompany[key].avgRating = Math.round((byCompany[key].avgRating / byCompany[key].count) * 10) / 10;
    }

    // Rating trend (by date)
    const ratingTrend = notes
      .sort((a, b) => new Date(a.interviewDate).getTime() - new Date(b.interviewDate).getTime())
      .map(n => ({
        date: n.interviewDate,
        rating: n.selfRating,
        company: n.companyName,
        type: n.interviewType,
      }));

    // Strength & weakness frequency
    const strengthFrequency: Record<string, number> = {};
    const weaknessFrequency: Record<string, number> = {};
    for (const note of notes) {
      for (const s of note.strengths) {
        strengthFrequency[s] = (strengthFrequency[s] || 0) + 1;
      }
      for (const w of note.weaknesses) {
        weaknessFrequency[w] = (weaknessFrequency[w] || 0) + 1;
      }
    }

    // Feedback summary
    const allFeedbacks = notes.flatMap(n => n.feedbacks);
    let feedbackSummary: { totalFeedbacks: number; averageRating: number; recommendationCounts: Record<string, number> } | null = null;
    if (allFeedbacks.length > 0) {
      const avgFeedbackRating = allFeedbacks.reduce((s, f) => s + f.rating, 0) / allFeedbacks.length;
      const recommendationCounts: Record<string, number> = {};
      for (const f of allFeedbacks) {
        recommendationCounts[f.recommendation] = (recommendationCounts[f.recommendation] || 0) + 1;
      }
      feedbackSummary = {
        totalFeedbacks: allFeedbacks.length,
        averageRating: Math.round(avgFeedbackRating * 10) / 10,
        recommendationCounts,
      };
    }

    return {
      totalInterviews: total,
      averageSelfRating: Math.round(avgRating * 10) / 10,
      byType,
      byCompany,
      ratingTrend,
      strengthFrequency,
      weaknessFrequency,
      feedbackSummary,
      recentNotes: notes.slice(0, 5),
    };
  }
}
