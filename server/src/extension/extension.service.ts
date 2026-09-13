import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface UserProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  headline?: string;
  summary?: string;
  skills: string[];
  experience: { company: string; title: string; startDate: string; endDate?: string; current: boolean; description: string; technologies: string[] }[];
  education: { institution: string; degree: string; fieldOfStudy?: string; startDate: string; endDate?: string; current: boolean; gpa?: string }[];
  projects: { title: string; description: string; projectUrl?: string; githubUrl?: string; technologies: string[] }[];
  certifications: { name: string; issuer: string; issueDate: string; expiryDate?: string }[];
  languages: { language: string; proficiency: string }[];
  preferredJobTypes: string[];
  preferredRemoteTypes: string[];
  updatedAt: string;
}

@Injectable()
export class ExtensionService {
  private readonly logger = new Logger(ExtensionService.name);

  constructor(private prisma: PrismaService) {}

  async getUserProfile(userId: string): Promise<Partial<UserProfile>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        resumes: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const latestResume = user.resumes[0];
    let parsedProfile: any = {};

    if (latestResume?.textContent) {
      try {
        parsedProfile = JSON.parse(latestResume.textContent);
      } catch {
        parsedProfile = this.extractBasicProfile(latestResume.textContent, user.name);
      }
    }

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      firstName: user.name.split(' ')[0] || '',
      lastName: user.name.split(' ').slice(1).join(' ') || '',
      phone: parsedProfile.phone || '',
      location: parsedProfile.location || '',
      linkedinUrl: parsedProfile.linkedin || '',
      githubUrl: parsedProfile.github || '',
      portfolioUrl: parsedProfile.portfolio || '',
      headline: parsedProfile.headline || parsedProfile.title || '',
      summary: parsedProfile.summary || '',
      skills: parsedProfile.skills || [],
      experience: parsedProfile.experience || [],
      education: parsedProfile.education || [],
      projects: parsedProfile.projects || [],
      certifications: parsedProfile.certifications || [],
      languages: parsedProfile.languages || [],
      preferredJobTypes: parsedProfile.preferredJobTypes || [],
      preferredRemoteTypes: parsedProfile.preferredRemoteTypes || [],
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private extractBasicProfile(text: string, fallbackName: string): any {
    const lines = text.split('\n').filter(l => l.trim());
    return {
      summary: lines.slice(0, 5).join(' ').substring(0, 500),
      skills: this.extractSkills(text),
    };
  }

  private extractSkills(text: string): string[] {
    const skillKeywords = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
      'React', 'Angular', 'Vue', 'Node.js', 'Express', 'NestJS', 'Django', 'Flask', 'Spring',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST', 'API',
      'Machine Learning', 'Data Science', 'AI', 'Deep Learning', 'NLP',
      'Agile', 'Scrum', 'Jira', 'Project Management', 'Leadership',
    ];
    return skillKeywords.filter(skill =>
      text.toLowerCase().includes(skill.toLowerCase()),
    );
  }

  async authenticateExtensionUser(email: string, password: string): Promise<{ accessToken: string; userId: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }
    const accessToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    return { accessToken, userId: user.id };
  }

  async createApplicationBundle(userId: string, data: {
    jobId?: string;
    resumeId?: string;
    coverLetterId?: string;
    notes?: string;
    companyName: string;
    roleTitle: string;
  }) {
    const bundle = await this.prisma.jobApplication.create({
      data: {
        userId,
        jobId: data.jobId || null,
        resumeId: data.resumeId || null,
        coverLetterId: data.coverLetterId || null,
        companyName: data.companyName,
        roleTitle: data.roleTitle,
        notes: data.notes || '',
        status: 'draft',
      },
    });
    this.logger.log(`Created application bundle for user ${userId}: ${bundle.id}`);
    return bundle;
  }

  async getApplicationBundles(userId: string, filters?: { status?: string }) {
    return this.prisma.jobApplication.findMany({
      where: {
        userId,
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { job: true },
    });
  }

  async getApplicationBundle(userId: string, bundleId: string) {
    const bundle = await this.prisma.jobApplication.findFirst({
      where: { id: bundleId, userId },
      include: {
        job: true,
        communications: { orderBy: { occurredAt: 'desc' } },
        referral: true,
      },
    });
    if (!bundle) {
      throw new NotFoundException('Application not found');
    }
    return bundle;
  }

  async updateApplicationBundle(userId: string, bundleId: string, data: any) {
    const existing = await this.prisma.jobApplication.findFirst({
      where: { id: bundleId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Application not found');
    }
    return this.prisma.jobApplication.update({
      where: { id: bundleId },
      data: { ...data, status: data.status || existing.status },
    });
  }

  async deleteApplicationBundle(userId: string, bundleId: string) {
    const existing = await this.prisma.jobApplication.findFirst({
      where: { id: bundleId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Application not found');
    }
    await this.prisma.jobApplication.delete({ where: { id: bundleId } });
  }

  async addCommunicationLog(userId: string, data: {
    applicationId: string;
    type: string;
    content: string;
    subject?: string;
    direction?: string;
    occurredAt?: string;
    outcome?: string;
  }) {
    const application = await this.prisma.jobApplication.findFirst({
      where: { id: data.applicationId, userId },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return this.prisma.communicationLog.create({
      data: {
        applicationId: data.applicationId,
        type: data.type,
        subject: data.subject || null,
        content: data.content,
        direction: data.direction || null,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
        outcome: data.outcome || null,
      },
    });
  }

  async getCommunicationLogs(userId: string, applicationId: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return this.prisma.communicationLog.findMany({
      where: { applicationId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async upsertReferral(userId: string, data: {
    applicationId: string;
    employeeName: string;
    employeeEmail?: string;
    relationship?: string;
    status?: string;
    notes?: string;
    requestedAt?: string;
    respondedAt?: string;
  }) {
    const application = await this.prisma.jobApplication.findFirst({
      where: { id: data.applicationId, userId },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return this.prisma.referralRequest.upsert({
      where: { applicationId: data.applicationId },
      create: {
        applicationId: data.applicationId,
        employeeName: data.employeeName,
        employeeEmail: data.employeeEmail || null,
        relationship: data.relationship || null,
        status: data.status || 'requested',
        notes: data.notes || null,
        requestedAt: data.requestedAt ? new Date(data.requestedAt) : new Date(),
        respondedAt: data.respondedAt ? new Date(data.respondedAt) : null,
      },
      update: {
        employeeName: data.employeeName,
        employeeEmail: data.employeeEmail ?? undefined,
        relationship: data.relationship ?? undefined,
        status: data.status ?? undefined,
        notes: data.notes ?? undefined,
        respondedAt: data.respondedAt ? new Date(data.respondedAt) : undefined,
      },
    });
  }

  async getReferral(userId: string, applicationId: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return this.prisma.referralRequest.findUnique({ where: { applicationId } });
  }

  async getApplicationAnalytics(userId: string, filters?: { startDate?: string; endDate?: string }) {
    // Build the createdAt range in one object — two spreads would overwrite
    // the key and silently drop the start bound when both filters are set.
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters?.startDate) createdAt.gte = new Date(filters.startDate);
    if (filters?.endDate) createdAt.lte = new Date(filters.endDate);

    const where: Prisma.JobApplicationWhereInput = {
      userId,
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    };

    const applications = await this.prisma.jobApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const total = applications.length;
    const byStatus: Record<string, number> = {};
    for (const app of applications) {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;
    }

    const applied = byStatus['applied'] || 0;
    const phoneScreen = byStatus['phone_screen'] || 0;
    const interviewing = byStatus['interviewing'] || 0;
    const offer = byStatus['offer'] || 0;
    const accepted = byStatus['accepted'] || 0;
    const rejected = byStatus['rejected'] || 0;
    const withdrawn = byStatus['withdrawn'] || 0;
    const draft = byStatus['draft'] || 0;

    return {
      total,
      byStatus,
      draft,
      applied,
      phoneScreen,
      interviewing,
      offer,
      rejected,
      accepted,
      withdrawn,
      conversionRates: {
        appliedToScreen: applied > 0 ? ((phoneScreen / applied) * 100).toFixed(1) + '%' : '0%',
        screenToInterview: phoneScreen > 0 ? ((interviewing / phoneScreen) * 100).toFixed(1) + '%' : '0%',
        interviewToOffer: interviewing > 0 ? ((offer / interviewing) * 100).toFixed(1) + '%' : '0%',
        appliedToOffer: applied > 0 ? ((offer / applied) * 100).toFixed(1) + '%' : '0%',
        overallSuccess: total > 0 ? ((accepted / total) * 100).toFixed(1) + '%' : '0%',
      },
    };
  }
}
