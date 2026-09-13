import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { withAiGateway } from '../common/ai-gateway';
import {
  POST_ONBOARDING_SYSTEM,
  buildOnboardingPlanPrompt,
  buildOnboardingChecklistPrompt,
  buildManagerAlignmentPrompt,
  buildNetworkMapPrompt,
  buildSkillRefreshPrompt,
  buildFirst90DaysPrompt,
} from './prompts';
import type {
  OnboardingMilestone,
  LearningGoal,
  Stakeholder,
  ChecklistCategory,
  ChecklistItem,
  SuccessMetric,
  CommunicationPreferences,
  MeetingCadence,
  NetworkContact,
  CoffeeChat,
  SkillRecommendation,
  LearningPathItem,
  First90Milestone,
  FeedbackLoop,
  EarlyWin,
} from '../common/types';

@Injectable()
export class PostOnboardingService {
  private readonly logger = new Logger(PostOnboardingService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  // ─── 30-60-90 Day Plan Builder ───

  async createOnboardingPlan(userId: string, data: {
    applicationId?: string;
    companyName: string;
    roleTitle: string;
    jobDescription?: string;
    resumeText?: string;
    startDate?: string;
    planType?: string;
  }) {
    const prompt = buildOnboardingPlanPrompt({
      roleTitle: data.roleTitle,
      companyName: data.companyName,
      jobDescription: data.jobDescription,
      resumeText: data.resumeText,
      startDate: data.startDate,
      planType: data.planType,
    });

    const parsed = await withAiGateway('PostOnboardingService.createOnboardingPlan', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: POST_ONBOARDING_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3 },
      );

      return this.aiService.parseAIResponse<{
        milestones: any[];
        learningGoals: any[];
        stakeholders: any[];
        summary: string;
      }>(this.aiService.getResponseText(result));
    });

    return this.prisma.onboardingPlan.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        startDate: data.startDate || null,
        planType: data.planType || '30-60-90',
        milestones: parsed.milestones,
        learningGoals: parsed.learningGoals,
        stakeholders: parsed.stakeholders,
        summary: parsed.summary,
      },
    });
  }

  async listOnboardingPlans(userId: string) {
    return this.prisma.onboardingPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOnboardingPlan(userId: string, id: string) {
    const plan = await this.prisma.onboardingPlan.findFirst({ where: { id, userId } });
    if (!plan) throw new NotFoundException('Onboarding plan not found');
    return plan;
  }

  async deleteOnboardingPlan(userId: string, id: string) {
    const plan = await this.prisma.onboardingPlan.findFirst({ where: { id, userId } });
    if (!plan) throw new NotFoundException('Onboarding plan not found');
    await this.prisma.onboardingPlan.delete({ where: { id } });
  }

  // ─── Onboarding Checklist ───

  async createOnboardingChecklist(userId: string, data: {
    applicationId?: string;
    companyName: string;
    roleTitle: string;
    startDate?: string;
  }) {
    const prompt = buildOnboardingChecklistPrompt({
      roleTitle: data.roleTitle,
      companyName: data.companyName,
      startDate: data.startDate,
    });

    const parsed = await withAiGateway('PostOnboardingService.createOnboardingChecklist', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: POST_ONBOARDING_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3 },
      );

      return this.aiService.parseAIResponse<{
        categories: any[];
        totalCount: number;
      }>(this.aiService.getResponseText(result));
    });

    return this.prisma.onboardingChecklist.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        startDate: data.startDate || null,
        categories: parsed.categories,
        completedCount: 0,
        totalCount: parsed.totalCount,
      },
    });
  }

  async listOnboardingChecklists(userId: string) {
    return this.prisma.onboardingChecklist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOnboardingChecklist(userId: string, id: string) {
    const checklist = await this.prisma.onboardingChecklist.findFirst({ where: { id, userId } });
    if (!checklist) throw new NotFoundException('Onboarding checklist not found');
    return checklist;
  }

  async updateChecklistItem(userId: string, id: string, data: {
    categoryIndex: number;
    itemIndex: number;
    completed: boolean;
  }) {
    const checklist = await this.prisma.onboardingChecklist.findFirst({ where: { id, userId } });
    if (!checklist) throw new NotFoundException('Onboarding checklist not found');

    const categories = checklist.categories as any[];
    if (categories[data.categoryIndex]?.items[data.itemIndex]) {
      categories[data.categoryIndex].items[data.itemIndex].completed = data.completed;
      
      let completedCount = 0;
      categories.forEach((cat: any) => {
        cat.items.forEach((item: any) => {
          if (item.completed) completedCount++;
        });
      });

      await this.prisma.onboardingChecklist.update({
        where: { id },
        data: { categories, completedCount },
      });
    }

    return this.prisma.onboardingChecklist.findFirst({ where: { id, userId } });
  }

  async deleteOnboardingChecklist(userId: string, id: string) {
    const checklist = await this.prisma.onboardingChecklist.findFirst({ where: { id, userId } });
    if (!checklist) throw new NotFoundException('Onboarding checklist not found');
    await this.prisma.onboardingChecklist.delete({ where: { id } });
  }

  // ─── Manager Alignment Tool ───

  async createManagerAlignment(userId: string, data: {
    applicationId?: string;
    companyName: string;
    roleTitle: string;
    managerName?: string;
    jobDescription?: string;
  }) {
    const prompt = buildManagerAlignmentPrompt({
      roleTitle: data.roleTitle,
      companyName: data.companyName,
      managerName: data.managerName,
      jobDescription: data.jobDescription,
    });

    const parsed = await withAiGateway('PostOnboardingService.createManagerAlignment', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: POST_ONBOARDING_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3 },
      );

      return this.aiService.parseAIResponse<{
        successMetrics: any[];
        communicationStyle: any;
        meetingCadence: any[];
        expectations: string;
      }>(this.aiService.getResponseText(result));
    });

    return this.prisma.managerAlignment.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        managerName: data.managerName || null,
        successMetrics: parsed.successMetrics,
        communicationStyle: parsed.communicationStyle,
        meetingCadence: parsed.meetingCadence,
        expectations: parsed.expectations,
      },
    });
  }

  async listManagerAlignments(userId: string) {
    return this.prisma.managerAlignment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getManagerAlignment(userId: string, id: string) {
    const alignment = await this.prisma.managerAlignment.findFirst({ where: { id, userId } });
    if (!alignment) throw new NotFoundException('Manager alignment not found');
    return alignment;
  }

  async deleteManagerAlignment(userId: string, id: string) {
    const alignment = await this.prisma.managerAlignment.findFirst({ where: { id, userId } });
    if (!alignment) throw new NotFoundException('Manager alignment not found');
    await this.prisma.managerAlignment.delete({ where: { id } });
  }

  // ─── Network Mapping ───

  async createNetworkMap(userId: string, data: {
    applicationId?: string;
    companyName: string;
    roleTitle: string;
    jobDescription?: string;
  }) {
    const prompt = buildNetworkMapPrompt({
      roleTitle: data.roleTitle,
      companyName: data.companyName,
      jobDescription: data.jobDescription,
    });

    const parsed = await withAiGateway('PostOnboardingService.createNetworkMap', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: POST_ONBOARDING_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3 },
      );

      return this.aiService.parseAIResponse<{
        contacts: any[];
        coffeeChats: any[];
        relationshipMap: any;
      }>(this.aiService.getResponseText(result));
    });

    return this.prisma.networkMap.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        contacts: parsed.contacts,
        coffeeChats: parsed.coffeeChats,
        relationshipMap: parsed.relationshipMap,
      },
    });
  }

  async listNetworkMaps(userId: string) {
    return this.prisma.networkMap.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNetworkMap(userId: string, id: string) {
    const map = await this.prisma.networkMap.findFirst({ where: { id, userId } });
    if (!map) throw new NotFoundException('Network map not found');
    return map;
  }

  async deleteNetworkMap(userId: string, id: string) {
    const map = await this.prisma.networkMap.findFirst({ where: { id, userId } });
    if (!map) throw new NotFoundException('Network map not found');
    await this.prisma.networkMap.delete({ where: { id } });
  }

  // ─── Skill Refresh Recommendations ───

  async createSkillRefresh(userId: string, data: {
    applicationId?: string;
    companyName: string;
    roleTitle: string;
    techStack: string[];
    jobDescription?: string;
    resumeText?: string;
  }) {
    const prompt = buildSkillRefreshPrompt({
      roleTitle: data.roleTitle,
      companyName: data.companyName,
      techStack: data.techStack,
      jobDescription: data.jobDescription,
      resumeText: data.resumeText,
    });

    const parsed = await withAiGateway('PostOnboardingService.createSkillRefresh', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: POST_ONBOARDING_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3 },
      );

      return this.aiService.parseAIResponse<{
        recommendations: any[];
        learningPath: any[];
        estimatedHours: number;
      }>(this.aiService.getResponseText(result));
    });

    return this.prisma.skillRefresh.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        techStack: data.techStack,
        recommendations: parsed.recommendations,
        learningPath: parsed.learningPath,
        estimatedHours: parsed.estimatedHours,
      },
    });
  }

  async listSkillRefreshes(userId: string) {
    return this.prisma.skillRefresh.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSkillRefresh(userId: string, id: string) {
    const refresh = await this.prisma.skillRefresh.findFirst({ where: { id, userId } });
    if (!refresh) throw new NotFoundException('Skill refresh not found');
    return refresh;
  }

  async deleteSkillRefresh(userId: string, id: string) {
    const refresh = await this.prisma.skillRefresh.findFirst({ where: { id, userId } });
    if (!refresh) throw new NotFoundException('Skill refresh not found');
    await this.prisma.skillRefresh.delete({ where: { id } });
  }

  // ─── First 90 Days Tracker ───

  async createFirst90DaysTracker(userId: string, data: {
    applicationId?: string;
    companyName: string;
    roleTitle: string;
    jobDescription?: string;
    startDate?: string;
  }) {
    const prompt = buildFirst90DaysPrompt({
      roleTitle: data.roleTitle,
      companyName: data.companyName,
      jobDescription: data.jobDescription,
    });

    const parsed = await withAiGateway('PostOnboardingService.createFirst90DaysTracker', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: POST_ONBOARDING_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3 },
      );

      return this.aiService.parseAIResponse<{
        milestones: any[];
        feedbackLoops: any[];
        earlyWins: any[];
      }>(this.aiService.getResponseText(result));
    });

    return this.prisma.first90DaysTracker.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        startDate: data.startDate || null,
        milestones: parsed.milestones,
        feedbackLoops: parsed.feedbackLoops,
        earlyWins: parsed.earlyWins,
        currentPhase: 'learning',
        overallProgress: 0,
      },
    });
  }

  async listFirst90DaysTrackers(userId: string) {
    return this.prisma.first90DaysTracker.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFirst90DaysTracker(userId: string, id: string) {
    const tracker = await this.prisma.first90DaysTracker.findFirst({ where: { id, userId } });
    if (!tracker) throw new NotFoundException('First 90 days tracker not found');
    return tracker;
  }

  async updateFirst90DaysTracker(userId: string, id: string, data: {
    currentPhase?: string;
    overallProgress?: number;
    milestones?: any[];
    earlyWins?: any[];
  }) {
    const tracker = await this.prisma.first90DaysTracker.findFirst({ where: { id, userId } });
    if (!tracker) throw new NotFoundException('First 90 days tracker not found');

    return this.prisma.first90DaysTracker.update({
      where: { id },
      data,
    });
  }

  async deleteFirst90DaysTracker(userId: string, id: string) {
    const tracker = await this.prisma.first90DaysTracker.findFirst({ where: { id, userId } });
    if (!tracker) throw new NotFoundException('First 90 days tracker not found');
    await this.prisma.first90DaysTracker.delete({ where: { id } });
  }
}
