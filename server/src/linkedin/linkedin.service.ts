import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { withAiGateway } from '../common/ai-gateway';

@Injectable()
export class LinkedInService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async analyze(
    userId: string,
    body: { profileText: string; profileUrl?: string; targetRole?: string },
  ) {
    const profile = await this.prisma.linkedInProfile.create({
      data: {
        userId,
        profileText: body.profileText,
        profileUrl: body.profileUrl || null,
        targetRole: body.targetRole || null,
      },
    });

    const result = await this.runAnalysis(body.profileText, body.targetRole);

    const updated = await this.prisma.linkedInProfile.update({
      where: { id: profile.id },
      data: { analysisResult: result as any },
    });

    return updated;
  }

  async findAll(userId: string) {
    return this.prisma.linkedInProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        profileUrl: true,
        targetRole: true,
        analysisResult: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findById(id: string, userId: string) {
    const profile = await this.prisma.linkedInProfile.findFirst({
      where: { id, userId },
    });
    if (!profile) {
      throw new NotFoundException('LinkedIn profile not found');
    }
    return profile;
  }

  async remove(id: string, userId: string) {
    await this.findById(id, userId);
    await this.prisma.linkedInProfile.delete({ where: { id } });
    return { message: 'LinkedIn profile deleted successfully' };
  }

  async reanalyze(
    id: string,
    userId: string,
    body: { targetRole?: string },
  ) {
    const profile = await this.findById(id, userId);
    if (!profile.profileText) {
      throw new NotFoundException('No profile text available for reanalysis');
    }

    const targetRole = body.targetRole || profile.targetRole || undefined;
    const result = await this.runAnalysis(profile.profileText, targetRole);

    const updated = await this.prisma.linkedInProfile.update({
      where: { id },
      data: {
        targetRole: targetRole || profile.targetRole,
        analysisResult: result as any,
      },
    });

    return updated;
  }

  private async runAnalysis(profileText: string, targetRole?: string) {
    const targetRoleContext = targetRole
      ? `\n\nThe user is targeting the following role: ${targetRole}`
      : '';

    const prompt = `You are an expert LinkedIn profile optimizer. Analyze the following LinkedIn profile text and provide detailed, actionable recommendations to improve it for better visibility, engagement, and recruiter appeal.${targetRoleContext}

Profile text:
${profileText}

Provide your analysis as a JSON object with the following structure:
{
  "overallScore": <number 0-100>,
  "headlineScore": <number 0-100>,
  "summaryScore": <number 0-100>,
  "experienceScore": <number 0-100>,
  "skillsScore": <number 0-100>,
  "headlines": [
    { "current": "<current headline if found>", "suggested": "<improved headline>", "reason": "<why this is better>" }
  ],
  "summaryImprovements": [
    { "area": "<area to improve>", "current": "<what's currently there>", "suggested": "<suggested improvement>", "reason": "<why this helps>" }
  ],
  "experienceImprovements": [
    { "title": "<experience entry title>", "current": "<current description>", "suggested": "<improved description>", "reason": "<why this is better>" }
  ],
  "skillRecommendations": {
    "toAdd": ["<skills to add based on market demand and target role>"],
    "toHighlight": ["<skills already present that should be more prominent>"],
    "toRemove": ["<irrelevant or outdated skills>"]
  },
  "keywordSuggestions": ["<industry keywords to include for better search ranking>"],
  "networkingTips": ["<actionable networking strategies>"],
  "contentStrategy": ["<content posting and engagement recommendations>"],
  "summary": "<brief overall assessment of the profile>"
}`;

    return withAiGateway('LinkedInService.runAnalysis', async () => {
      const aiResponse = await this.aiService.chat(
        [{ role: 'user', content: prompt }],
        {
          response_format: { type: 'json_object' },
          temperature: 0.7,
        },
      );

      return this.aiService.parseAIResponse(
        this.aiService.getResponseText(aiResponse),
      );
    });
  }
}
