import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { withAiGateway } from '../common/ai-gateway';
import {
  buildNegotiationCoachPrompt,
  buildEquityCalculatorPrompt,
  buildBenefitsAnalyzerPrompt,
  buildDecisionFrameworkPrompt,
  buildResignationLetterPrompt,
  NEGOTIATION_COACH_SYSTEM,
} from './prompts';
import type {
  OfferItem,
  OfferComparisonItem,
  NegotiationCoach,
  EquityCalculationResult,
  BenefitsAnalysisResult,
  DecisionCriterion,
  OfferDecision,
} from '../common/types';

interface OfferScore {
  offerId: string;
  totalScore: number;
  criterionScores: { criterion: string; score: number; maxScore: number; notes: string }[];
}

@Injectable()
export class OfferNegotiationService {
  private readonly logger = new Logger(OfferNegotiationService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  // ─── Offer Comparison ───

  async createComparison(userId: string, data: {
    name: string;
    offers: OfferItem[];
    weights?: OfferComparisonItem['weights'];
    applicationId?: string;
  }) {
    const parsed = await withAiGateway('OfferNegotiationService.createComparison', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: NEGOTIATION_COACH_SYSTEM },
          {
            role: 'user',
            content: `Compare these job offers and provide weighted scores for each.\n\nOffers:\n${JSON.stringify(data.offers, null, 2)}\n\nWeights:\n${JSON.stringify(data.weights || { compensation: 30, growth: 20, culture: 20, workLifeBalance: 15, location: 10, benefits: 5 }, null, 2)}\n\nScore each offer 0-10 on each criterion. Calculate weighted totals. Provide a recommendation. Return JSON with { scores: [{ offerName, totalScore, criterionScores: [{ criterion, score, maxScore, notes }] }], recommendation: string }.`
          },
        ],
        { temperature: 0.3 },
      );

      return this.aiService.parseAIResponse<{
        scores: Array<{
          offerName: string;
          totalScore: number;
          criterionScores: Array<{ criterion: string; score: number; maxScore: number; notes: string }>;
        }>;
        recommendation: string;
      }>(this.aiService.getResponseText(result));
    });

    // Link the comparison back to the application it came from when provided.
    // Ownership is implied by userId, but the FK must actually resolve.
    if (data.applicationId) {
      const app = await this.prisma.jobApplication.findFirst({
        where: { id: data.applicationId, userId },
        select: { id: true },
      });
      if (!app) throw new NotFoundException('Application not found');
    }

    return this.prisma.offerComparison.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        name: data.name,
        offers: data.offers as any,
        weights: data.weights || { compensation: 30, growth: 20, culture: 20, workLifeBalance: 15, location: 10, benefits: 5 },
        scores: parsed.scores as any,
        recommendation: parsed.recommendation,
      },
    });
  }

  async listComparisons(userId: string) {
    return this.prisma.offerComparison.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { application: { select: { id: true, companyName: true, roleTitle: true, status: true } } },
    });
  }

  async getComparison(userId: string, id: string) {
    const comp = await this.prisma.offerComparison.findFirst({
      where: { id, userId },
      include: { application: { select: { id: true, companyName: true, roleTitle: true, status: true } } },
    });
    if (!comp) throw new NotFoundException('Offer comparison not found');
    return comp;
  }

  async deleteComparison(userId: string, id: string) {
    const comp = await this.prisma.offerComparison.findFirst({ where: { id, userId } });
    if (!comp) throw new NotFoundException('Offer comparison not found');
    await this.prisma.offerComparison.delete({ where: { id } });
  }

  // ─── Negotiation Coach ───

  async createCoach(userId: string, data: {
    applicationId?: string;
    companyName: string;
    roleTitle: string;
    jobDescription?: string;
    resumeText?: string;
    offerDetails: {
      baseSalary: number;
      equity?: number;
      equityType?: string;
      bonus?: number;
      signOn?: number;
      benefits?: string[];
    };
  }) {
    const prompt = buildNegotiationCoachPrompt({
      roleTitle: data.roleTitle,
      companyName: data.companyName,
      jobDescription: data.jobDescription,
      resumeText: data.resumeText,
      offerDetails: data.offerDetails,
    });

    // Link the coach session back to the application it came from when
    // provided. Ownership is implied by userId, but the FK must resolve.
    if (data.applicationId) {
      const app = await this.prisma.jobApplication.findFirst({
        where: { id: data.applicationId, userId },
        select: { id: true },
      });
      if (!app) throw new NotFoundException('Application not found');
    }

    const parsed = await withAiGateway('OfferNegotiationService.createCoach', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: NEGOTIATION_COACH_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3 },
      );

      return this.aiService.parseAIResponse<{
        marketData: NegotiationCoach['marketData'];
        strategy: NegotiationCoach['strategy'];
        emailTemplates: NegotiationCoach['emailTemplates'];
        scripts: NegotiationCoach['scripts'];
      }>(this.aiService.getResponseText(result));
    });

    return this.prisma.negotiationCoach.create({
      data: {
        userId,
        applicationId: data.applicationId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        offerDetails: data.offerDetails,
        marketData: parsed.marketData,
        strategy: parsed.strategy,
        emailTemplates: parsed.emailTemplates,
        scripts: parsed.scripts,
      },
    });
  }

  async listCoaches(userId: string) {
    return this.prisma.negotiationCoach.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { application: { select: { id: true, companyName: true, roleTitle: true, status: true } } },
    });
  }

  async getCoach(userId: string, id: string) {
    const coach = await this.prisma.negotiationCoach.findFirst({
      where: { id, userId },
      include: { application: { select: { id: true, companyName: true, roleTitle: true, status: true } } },
    });
    if (!coach) throw new NotFoundException('Negotiation coach not found');
    return coach;
  }

  async deleteCoach(userId: string, id: string) {
    const coach = await this.prisma.negotiationCoach.findFirst({ where: { id, userId } });
    if (!coach) throw new NotFoundException('Negotiation coach not found');
    await this.prisma.negotiationCoach.delete({ where: { id } });
  }

  // ─── Equity Calculator ───

  async calculateEquity(userId: string, data: {
    roleTitle: string;
    equityDetails: {
      totalShares: number;
      sharePrice: number;
      vestingSchedule: string;
      vestingCliff?: number;
      equityType: string;
      strikePrice?: number;
      refreshGrant?: number;
      currentSalary: number;
    };
  }) {
    const prompt = buildEquityCalculatorPrompt({
      roleTitle: data.roleTitle,
      equityDetails: data.equityDetails,
    });

    return withAiGateway('OfferNegotiationService.calculateEquity', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: 'You are an equity compensation expert specializing in startup and public company equity packages. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.2 },
      );

      return this.aiService.parseAIResponse(this.aiService.getResponseText(result));
    });
  }

  // ─── Benefits Analyzer ───

  async analyzeBenefits(userId: string, data: {
    roleTitle: string;
    companyName: string;
    benefits: string[];
    salary: number;
  }) {
    const prompt = buildBenefitsAnalyzerPrompt({
      roleTitle: data.roleTitle,
      companyName: data.companyName,
      benefits: data.benefits,
      salary: data.salary,
    });

    return withAiGateway('OfferNegotiationService.analyzeBenefits', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: 'You are a benefits and total compensation analyst. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.2 },
      );

      return this.aiService.parseAIResponse(this.aiService.getResponseText(result));
    });
  }

  // ─── Decision Framework ───

  async createDecision(userId: string, data: {
    name: string;
    criteria: { id: string; name: string; weight: number }[];
    offers: OfferItem[];
    notes?: string;
  }) {
    const prompt = buildDecisionFrameworkPrompt({
      criteria: data.criteria,
      offers: data.offers,
    });

    const parsed = await withAiGateway('OfferNegotiationService.createDecision', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: 'You are a career decision strategist. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3 },
      );

      return this.aiService.parseAIResponse<{
        summary: string;
        winner: string;
        winnerReason: string;
        offerScores: OfferScore[];
        sensitivityAnalysis: unknown[];
        recommendations: string[];
      }>(this.aiService.getResponseText(result));
    });

    return this.prisma.offerDecision.create({
      data: {
        userId,
        name: data.name,
        criteria: data.criteria as any,
        offers: data.offers as any,
        scores: parsed.offerScores as any,
        recommendation: parsed.summary,
        notes: data.notes || null,
      },
    });
  }

  async listDecisions(userId: string) {
    return this.prisma.offerDecision.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDecision(userId: string, id: string) {
    const decision = await this.prisma.offerDecision.findFirst({ where: { id, userId } });
    if (!decision) throw new NotFoundException('Decision framework not found');
    return decision;
  }

  async deleteDecision(userId: string, id: string) {
    const decision = await this.prisma.offerDecision.findFirst({ where: { id, userId } });
    if (!decision) throw new NotFoundException('Decision framework not found');
    await this.prisma.offerDecision.delete({ where: { id } });
  }

  // ─── Resignation Letter ───

  async generateResignationLetter(userId: string, data: {
    companyName: string;
    roleTitle: string;
    managerName?: string;
    lastDay?: string;
    reason?: string;
    tone?: string;
    yearsAtCompany?: number;
    keyAchievements?: string[];
    handoverNotes?: string;
  }) {
    const prompt = buildResignationLetterPrompt(data);

    const parsed = await withAiGateway('OfferNegotiationService.generateResignationLetter', async () => {
      const result = await this.aiService.chat(
        [
          { role: 'system', content: 'You are an expert career transition advisor. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.4 },
      );

      return this.aiService.parseAIResponse<{
        letter: string;
        transitionPlan: string;
        tips: string[];
        dosAndDonts: { dos: string[]; donts: string[] };
      }>(this.aiService.getResponseText(result));
    });

    return this.prisma.resignationLetter.create({
      data: {
        userId,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        managerName: data.managerName || null,
        lastDay: data.lastDay || null,
        reason: data.reason || null,
        tone: data.tone || null,
        letterContent: parsed.letter,
        transitionPlan: parsed.transitionPlan,
      },
    });
  }

  async listResignationLetters(userId: string) {
    return this.prisma.resignationLetter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getResignationLetter(userId: string, id: string) {
    const letter = await this.prisma.resignationLetter.findFirst({ where: { id, userId } });
    if (!letter) throw new NotFoundException('Resignation letter not found');
    return letter;
  }

  async deleteResignationLetter(userId: string, id: string) {
    const letter = await this.prisma.resignationLetter.findFirst({ where: { id, userId } });
    if (!letter) throw new NotFoundException('Resignation letter not found');
    await this.prisma.resignationLetter.delete({ where: { id } });
  }
}
