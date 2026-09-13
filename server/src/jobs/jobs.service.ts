import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Injectable, Logger, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { RedisService } from '../redis/redis.service';
import { prepareJobMatchInstructions, prepareBatchJobMatchInstructions, prepareSkillGapInstructions } from '../ai/prompts';
import { AiUnavailableException } from '../common/ai-gateway';

export interface JobSearchParams {
  keywords?: string[];
  location?: string;
  jobTypes?: string[];
  remoteTypes?: string[];
  experienceLevels?: string[];
  jobFunctions?: string[];
  sources?: string[];
  page?: number;
  limit?: number;
}

export interface ExternalJobPosting {
  title: string;
  companyName: string;
  location: string;
  description: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  jobType?: string;
  remoteType?: string;
  experienceLevel?: string;
  source: string;
  sourceUrl: string;
  postedAt?: Date;
  // JSearch enrichment fields
  workArrangement?: string;
  seniorityLevel?: string;
  requiredExperienceYears?: number;
  requiredTechnologies?: string[];
  preferredTechnologies?: string[];
  jobFunction?: string;
  industry?: string;
  educationRequired?: string;
  visaSponsorship?: boolean;
  relocationRequired?: boolean;
  relocationAssistance?: boolean;
  contractDuration?: string;
  startDate?: string;
  hasManagementResponsibilities?: boolean;
  aiMlInvolved?: boolean;
  benefitsExtended?: string[];
  softSkills?: string[];
}

interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_website?: string;
  employer_logo?: string;
  job_publisher?: string;
  job_location: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_description: string;
  job_apply_link: string;
  job_posted_at_datetime_utc: string;
  job_posted_at_timestamp: number;
  job_employment_type?: string;
  job_employment_types?: string[];
  job_is_remote?: boolean;
  job_salary_min?: number;
  job_salary_max?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
  job_highlights?: {
    Qualifications?: string[];
    Responsibilities?: string[];
    Benefits?: string[];
  };
  job_benefits?: string[];
  job_google_link?: string;
  job_onet_soc?: string;
  job_onet_job_zone?: string;
  // JSearch enrichment fields
  work_arrangement?: string;
  seniority_level?: string;
  required_experience_years?: number;
  required_technologies?: string[];
  preferred_technologies?: string[];
  job_function?: string;
  industry?: string;
  education_required?: string;
  visa_sponsorship?: boolean;
  relocation_required?: boolean;
  relocation_assistance?: boolean;
  contract_duration?: string;
  start_date?: string;
  has_management_responsibilities?: boolean;
  ai_ml_involved?: boolean;
  benefits_extended?: string[];
  soft_skills?: string[];
}

interface JSearchResponse {
  data: JSearchJob[];
  status: string;
  request_id: string;
  parameters: {
    query: string;
    page: number;
    num_pages: number;
    results_per_page: number;
  };
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly jsearchApiKey: string;
  private readonly jsearchApiHost: string;
  private readonly jsearchBaseUrl: string;
  private readonly rateLimitWindow = 60; // 1 minute
  private readonly rateLimitMax = 10; // 10 requests per minute per user
  private readonly cacheTtl = 3600; // 1 hour

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private aiService: AiService,
    private redis: RedisService,
    @InjectQueue('search-alerts') private searchAlertQueue: Queue,
  ) {
    this.jsearchApiKey = this.configService.get<string>('JSEARCH_API_KEY') || '';
    this.jsearchApiHost = this.configService.get<string>('JSEARCH_API_HOST') || 'jsearch.p.rapidapi.com';
    this.jsearchBaseUrl = `https://${this.jsearchApiHost}`;

    if (!this.jsearchApiKey) {
      this.logger.warn('JSEARCH_API_KEY not configured. Job search will use mock data.');
    }
  }

  /**
   * Search for jobs across multiple job boards with rate limiting and caching
   */
  async searchJobs(
    userId: string,
    params: JobSearchParams,
  ) {
    // Normalize array fields — query/body may send a single string
    const normalizeArray = (v: unknown): string[] =>
      Array.isArray(v) ? v : v ? [String(v)] : [];

    params.keywords = normalizeArray(params.keywords);
    params.jobTypes = normalizeArray(params.jobTypes);
    params.remoteTypes = normalizeArray(params.remoteTypes);
    params.experienceLevels = normalizeArray(params.experienceLevels);
    params.sources = normalizeArray(params.sources);

    // Rate limiting
    await this.checkRateLimit(userId);

    // Generate cache key
    const cacheKey = this.generateCacheKey(userId, params);

    // Always fetch fresh — clear old cache entries
    await this.redis.invalidateJobCache(userId);

    this.logger.log(`Searching jobs for user ${userId} with params:`, params);

    if (!this.jsearchApiKey) {
      throw new HttpException(
        'JSearch API key not configured. Set JSEARCH_API_KEY in your .env file.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const externalJobs = await this.searchJobsJSearch(params);

    // Deduplicate jobs within this response
    const uniqueExternalJobs = this.deduplicateJobs(externalJobs);

    // Clean up any old records with Google search URLs as sourceUrl
    await this.prisma.job.deleteMany({
      where: {
        userId,
        sourceUrl: { contains: 'google.com/search' },
      },
    });

    // Save jobs to database and collect the DB records (with id)
    const savedJobs: any[] = [];
    for (const job of uniqueExternalJobs) {
      const saved = await this.upsertJob(userId, job);
      savedJobs.push(saved);
    }

    // Cache the saved DB records (with id)
    await this.redis.setCachedJobs(cacheKey, savedJobs, this.cacheTtl);

    return {
      jobs: savedJobs,
      pagination: {
        page: params.page || 1,
        limit: params.limit || 20,
        total: savedJobs.length,
        totalPages: 1,
      },
    };
  }

  /**
   * Check rate limit for user
   */
  private async checkRateLimit(userId: string): Promise<void> {
    const key = `ratelimit:jobs:search:${userId}`;
    const count = await this.redis.incrementRateLimit(key, this.rateLimitWindow);
    
    if (count > this.rateLimitMax) {
      throw new HttpException(
        'Rate limit exceeded. Please wait before searching again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Generate cache key from search parameters
   */
  private generateCacheKey(userId: string, params: JobSearchParams): string {
    // Include only cache-relevant fields, explicitly handling undefined
    const key = {
      keywords: (params.keywords || []).sort().join(','),
      location: params.location || '',
      jobTypes: (params.jobTypes || []).sort().join(','),
      remoteTypes: (params.remoteTypes || []).sort().join(','),
      experienceLevels: (params.experienceLevels || []).sort().join(','),
      sources: (params.sources || []).sort().join(','),
      page: params.page || 1,
      limit: params.limit || 20,
    };
    return `${userId}:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }

  /**
   * Deduplicate jobs within a single response by source URL.
   * Per-user dedup is handled by upsertJob (userId + title + companyName).
   */
  private deduplicateJobs(jobs: ExternalJobPosting[]): ExternalJobPosting[] {
    const seen = new Set<string>();
    const unique: ExternalJobPosting[] = [];

    for (const job of jobs) {
      if (job.sourceUrl && !seen.has(job.sourceUrl)) {
        seen.add(job.sourceUrl);
        unique.push(job);
      } else if (!job.sourceUrl) {
        // Jobs without a sourceUrl are always included (synthetic IDs)
        unique.push(job);
      } else {
        this.logger.debug(`Duplicate job skipped: ${job.sourceUrl}`);
      }
    }

    return unique;
  }

  /**
   * Search jobs using JSearch API with retry and exponential backoff
   * Over-fetches then filters post-fetch for source/type/remote/experience
   */
  private async searchJobsJSearch(params: JobSearchParams, retries = 2): Promise<ExternalJobPosting[]> {
    const query = this.buildJSearchQuery(params);
    const page = params.page || 1;
    const requestedLimit = params.limit || 20;
    // Over-fetch to have enough after filtering
    const hasFilters = (params.sources && params.sources.length > 0)
      || (params.jobTypes && params.jobTypes.length > 0)
      || (params.remoteTypes && params.remoteTypes.length > 0)
      || (params.experienceLevels && params.experienceLevels.length > 0);
    const fetchLimit = hasFilters ? Math.min(requestedLimit * 3, 50) : Math.min(requestedLimit, 50);

    this.logger.log(`JSearch query: "${query}", page: ${page}, limit: ${requestedLimit} (fetching ${fetchLimit})`);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const url = `${this.jsearchBaseUrl}/search-v2?query=${encodeURIComponent(query)}&page=${page}&num_pages=1&results_per_page=${fetchLimit}&date_posted=all`;
        this.logger.debug(`JSearch request: ${url} (attempt ${attempt + 1}/${retries + 1})`);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': this.jsearchApiKey,
            'X-RapidAPI-Host': this.jsearchApiHost,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 429) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          this.logger.warn(`JSearch rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error(`JSearch HTTP ${response.status}: ${errorText}`);
          throw new Error(`JSearch API error: ${response.status}`);
        }

        const rawData = await response.json();

        // /search-v2 returns { data: { jobs: [...], cursor: ... } }
        const jobs: JSearchJob[] = Array.isArray(rawData.data?.jobs)
          ? rawData.data.jobs
          : Array.isArray(rawData.data)
            ? rawData.data
            : [];

        if (jobs.length === 0) {
          this.logger.warn(`JSearch returned 0 jobs for query "${query}"`);
          return [];
        }

        this.logger.log(`JSearch returned ${jobs.length} raw jobs`);

        // Map to external format
        let mapped = jobs.map((job) => this.mapJSearchJobToExternal(job));

        // Debug: log first job's URLs to verify source detection
        if (jobs.length > 0) {
          const sample = jobs[0];
          this.logger.debug(`Sample job URLs: publisher="${sample.job_publisher}", apply_link="${sample.job_apply_link?.substring(0, 100)}", google_link="${sample.job_google_link?.substring(0, 100)}"`);
        }

        // Apply post-fetch filters
        mapped = this.filterJobs(mapped, params);

        // Paginate to requested limit
        mapped = mapped.slice(0, requestedLimit);

        this.logger.log(`After filtering: ${mapped.length} jobs`);

        return mapped;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          this.logger.warn(`JSearch attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('JSearch API failed after retries');
  }

  /**
   * Filter mapped jobs by source, jobType, remoteType, experienceLevel
   */
  private filterJobs(jobs: ExternalJobPosting[], params: JobSearchParams): ExternalJobPosting[] {
    let filtered = jobs;

    // Source filter
    if (params.sources && params.sources.length > 0) {
      const sources = params.sources.map((s) => s.toLowerCase());
      filtered = filtered.filter((job) => sources.includes(job.source.toLowerCase()));
    }

    // Job type filter
    if (params.jobTypes && params.jobTypes.length > 0) {
      const types = params.jobTypes.map((t) => t.toLowerCase());
      filtered = filtered.filter((job) => job.jobType && types.includes(job.jobType.toLowerCase()));
    }

    // Remote type filter
    if (params.remoteTypes && params.remoteTypes.length > 0) {
      const remotes = params.remoteTypes.map((r) => r.toLowerCase());
      filtered = filtered.filter((job) => job.remoteType && remotes.includes(job.remoteType.toLowerCase()));
    }

    // Job function filter
    if (params.jobFunctions && params.jobFunctions.length > 0) {
      const functions = params.jobFunctions.map((f) => f.toLowerCase());
      filtered = filtered.filter((job) => job.jobFunction && functions.includes(job.jobFunction.toLowerCase()));
    }

    // Experience level filter — heuristic from title keywords
    if (params.experienceLevels && params.experienceLevels.length > 0) {
      const levelKeywords: Record<string, string[]> = {
        entry: ['junior', 'entry level', 'entry-level', 'associate', 'graduate', 'intern', 'trainee', '0-2 years', '1-2 years'],
        mid: ['mid level', 'mid-level', 'intermediate', '3-5 years', '3+ years', '4+ years', '5+ years'],
        senior: ['senior', 'sr.', 'sr ', 'lead', 'staff', 'principal', '7+ years', '8+ years', '10+ years'],
        lead: ['lead', 'principal', 'staff', 'architect', 'director'],
        executive: ['director', 'vp', 'vice president', 'head of', 'chief', 'cto', 'ceo', 'coo'],
      };

      filtered = filtered.filter((job) => {
        const title = (job.title || '').toLowerCase();
        return params.experienceLevels!.some((level) => {
          const keywords = levelKeywords[level] || [];
          return keywords.some((kw) => title.includes(kw));
        });
      });
    }

    return filtered;
  }

  /**
   * Build JSearch query string from parameters
   */
  private buildJSearchQuery(params: JobSearchParams): string {
    const parts: string[] = [];

    // Keywords
    if (params.keywords && params.keywords.length > 0) {
      parts.push(params.keywords.join(' '));
    } else {
      parts.push('software engineer');
    }

    // Location — JSearch supports "in {location}" in query
    if (params.location) {
      parts.push(`in ${params.location}`);
    }

    // Note: jobTypes, remoteTypes, experienceLevels, and sources
    // are NOT supported by JSearch API query syntax.
    // They are filtered post-fetch in filterJobs().

    return parts.join(' ');
  }

  /**
   * Map JSearch job to our external format
   */
  private mapJSearchJobToExternal(job: JSearchJob): ExternalJobPosting {
    const jobTypeMap: Record<string, string> = {
      'FULLTIME': 'full-time',
      'FULL_TIME': 'full-time',
      'PARTTIME': 'part-time',
      'PART_TIME': 'part-time',
      'CONTRACTOR': 'contract',
      'CONTRACT': 'contract',
      'INTERN': 'internship',
      'INTERNSHIP': 'internship',
      'TEMPORARY': 'contract',
      'OTHER': 'other',
    };

    let remoteType: string | undefined;
    // Prefer structured JSearch field, fall back to heuristic
    if (job.work_arrangement) {
      remoteType = job.work_arrangement.toLowerCase();
    } else if (job.job_is_remote === true) {
      remoteType = 'remote';
    } else if (job.job_description?.toLowerCase().includes('hybrid')
      || job.job_location?.toLowerCase().includes('hybrid')) {
      remoteType = 'hybrid';
    } else {
      remoteType = 'onsite';
    }

    let salaryMin = job.job_salary_min;
    let salaryMax = job.job_salary_max;
    const salaryCurrency = job.job_salary_currency || 'USD';

    // Normalize salary to yearly
    if (job.job_salary_period && job.job_salary_period !== 'YEAR') {
      const multiplier = this.getSalaryMultiplier(job.job_salary_period);
      if (salaryMin) salaryMin = Math.round(salaryMin * multiplier);
      if (salaryMax) salaryMax = Math.round(salaryMax * multiplier);
    }

    // Build requirements from highlights
    let requirements = '';
    if (job.job_highlights?.Qualifications) {
      requirements += 'Qualifications:\n' + job.job_highlights.Qualifications.join('\n') + '\n\n';
    }
    if (job.job_highlights?.Responsibilities) {
      requirements += 'Responsibilities:\n' + job.job_highlights.Responsibilities.join('\n') + '\n\n';
    }
    if (job.job_benefits && job.job_benefits.length > 0) {
      requirements += 'Benefits:\n' + job.job_benefits.join('\n');
    }

    // Determine source from job_publisher (most reliable) or URL
    const sourceUrl = job.job_apply_link || job.job_google_link || `job-${job.job_id}`;
    const source = this.determineJobSource(job);

    // Map employment type — check array first, then single field
    let jobType: string | undefined;
    if (job.job_employment_types && job.job_employment_types.length > 0) {
      const raw = job.job_employment_types[0];
      jobType = jobTypeMap[raw] || raw?.toLowerCase();
    } else if (job.job_employment_type) {
      jobType = jobTypeMap[job.job_employment_type] || job.job_employment_type.toLowerCase();
    }

    return {
      title: job.job_title,
      companyName: job.employer_name,
      location: job.job_location,
      description: job.job_description,
      requirements,
      salaryMin,
      salaryMax,
      salaryCurrency,
      jobType,
      remoteType,
      experienceLevel: job.seniority_level?.toLowerCase() || undefined,
      source,
      sourceUrl,
      postedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : undefined,
      // JSearch enrichment fields
      workArrangement: job.work_arrangement?.toLowerCase(),
      seniorityLevel: job.seniority_level?.toLowerCase(),
      requiredExperienceYears: job.required_experience_years ?? undefined,
      requiredTechnologies: job.required_technologies || [],
      preferredTechnologies: job.preferred_technologies || [],
      jobFunction: job.job_function?.toLowerCase(),
      industry: job.industry || undefined,
      educationRequired: job.education_required || undefined,
      visaSponsorship: job.visa_sponsorship ?? undefined,
      relocationRequired: job.relocation_required ?? undefined,
      relocationAssistance: job.relocation_assistance ?? undefined,
      contractDuration: job.contract_duration || undefined,
      startDate: job.start_date || undefined,
      hasManagementResponsibilities: job.has_management_responsibilities ?? undefined,
      aiMlInvolved: job.ai_ml_involved ?? undefined,
      benefitsExtended: job.benefits_extended || [],
      softSkills: job.soft_skills || [],
    };
  }

  /**
   * Determine job source from publisher field and URL
   */
  private determineJobSource(job: JSearchJob): string {
    const publisher = (job.job_publisher || '').toLowerCase();
    const url = (job.job_apply_link || '').toLowerCase();
    const googleUrl = (job.job_google_link || '').toLowerCase();

    // Publisher-based detection (most reliable)
    if (publisher.includes('linkedin')) return 'linkedin';
    if (publisher.includes('indeed')) return 'indeed';
    if (publisher.includes('glassdoor')) return 'glassdoor';
    if (publisher === 'bebee' || publisher === 'jooble' || publisher === 'simplyhired'
      || publisher === 'careerbuilder' || publisher === 'ziprecruiter'
      || publisher === 'built in' || publisher === 'adzuna'
      || publisher === 'dice' || publisher === 'hired') return 'company';

    // URL-based fallback
    if (url.includes('linkedin') || googleUrl.includes('linkedin')) return 'linkedin';
    if (url.includes('indeed') || googleUrl.includes('indeed')) return 'indeed';
    if (url.includes('glassdoor') || googleUrl.includes('glassdoor')) return 'glassdoor';

    return 'company';
  }

  /**
   * Get salary multiplier to convert to yearly
   */
  private getSalaryMultiplier(period: string): number {
    switch (period.toUpperCase()) {
      case 'HOUR': return 2080; // 40h * 52 weeks
      case 'DAY': return 260; // 5 days * 52 weeks
      case 'WEEK': return 52;
      case 'MONTH': return 12;
      case 'YEAR': return 1;
      default: return 1;
    }
  }

  /**
   * Upsert a job posting to the database
   */
  async upsertJob(userId: string, job: ExternalJobPosting) {
    // Find existing job by userId + title + companyName (more stable than sourceUrl)
    const existing = await this.prisma.job.findFirst({
      where: { userId, title: job.title, companyName: job.companyName },
    });

    if (existing) {
      // Update existing — but only update sourceUrl if the new one is NOT a Google link
      // Preserve user-set fields (isBookmarked, appliedAt, tags) — don't overwrite with external data
      const newSourceUrl = job.sourceUrl && !job.sourceUrl.includes('google.com/search')
        ? job.sourceUrl
        : existing.sourceUrl;

      const { isBookmarked, appliedAt, tags, ...externalData } = job as any;

      return this.prisma.job.update({
        where: { id: existing.id },
        data: {
          ...externalData,
          sourceUrl: newSourceUrl,
          userId,
        },
      });
    }

    // Create new — strip Google links from sourceUrl
    const sourceUrl = job.sourceUrl && !job.sourceUrl.includes('google.com/search')
      ? job.sourceUrl
      : `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return this.prisma.job.create({
      data: {
        ...job,
        sourceUrl,
        userId,
      },
    });
  }

  /**
   * Get saved jobs for a user with filtering
   */
  async getJobs(
    userId: string,
    filters: {
      source?: string;
      isBookmarked?: boolean;
      search?: string;
      jobType?: string;
      remoteType?: string;
      experienceLevel?: string;
      jobFunction?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const {
      source,
      isBookmarked,
      search,
      jobType,
      remoteType,
      experienceLevel,
      jobFunction,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { userId };

    if (source) where.source = source;
    if (isBookmarked !== undefined) where.isBookmarked = isBookmarked;
    if (jobType) where.jobType = jobType;
    if (remoteType) where.remoteType = remoteType;
    if (experienceLevel) where.experienceLevel = experienceLevel;
    if (jobFunction) where.jobFunction = jobFunction;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single job by ID
   */
  async getJobById(id: string, userId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
      }

  /**
   * Get full job details with skill match and skill gap analysis in one call
   */
  async getJobDetails(id: string, userId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, userId },
    });
    if (!job) throw new NotFoundException('Job not found');

    // Get user's most recent resume
    const resume = await this.prisma.resume.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!resume) {
      return {
        job,
        skillMatch: { percentage: 0, matchedSkills: [], missingSkills: [] },
        skillGap: null,
        resumeId: null,
      };
    }

    // Extract skills from resume and job description using keyword matching
    const resumeSkills = this.extractSkillsFromResume(resume);
    const jobText = `${job.title || ''} ${job.description || ''} ${job.requirements || ''}`.toLowerCase();
    const jobSkills = this.extractSkillsFromText(jobText);

    const matchedSkills = resumeSkills.filter((s) => jobSkills.includes(s));
    const missingSkills = jobSkills.filter((s) => !resumeSkills.includes(s));
    const percentage = jobSkills.length > 0
      ? Math.round((matchedSkills.length / jobSkills.length) * 100)
      : 0;

    // Run AI skill gap analysis (best-effort)
    let skillGap = null;
    try {
      const prompt = prepareSkillGapInstructions({
        jobTitle: job.title,
        jobDescription: job.description || '',
        resumeText: resume.textContent || '',
        feedback: JSON.stringify(resume.feedback || {}),
      });
      const aiResponse = await this.aiService.chat([
        { role: 'user', content: prompt },
      ]);
      skillGap = this.aiService.parseAIResponse(
        this.aiService.getResponseText(aiResponse),
      );
    } catch {
      // Skill gap analysis is best-effort
    }

    return {
      job,
      skillMatch: { percentage, matchedSkills, missingSkills },
      skillGap,
      resumeId: resume.id,
    };
  }

  /**
   * Extract known skills from arbitrary text
   */
  private extractSkillsFromText(text: string): string[] {
    const commonSkills = [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 'c#',
      'react', 'vue', 'angular', 'next.js', 'node.js', 'express', 'django', 'fastapi',
      'spring boot', 'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform',
      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      'git', 'ci/cd', 'jenkins', 'github actions', 'gitlab ci',
      'microservices', 'distributed systems', 'system design', 'graphql', 'rest api',
      'machine learning', 'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy',
      'data engineering', 'spark', 'kafka', 'airflow', 'dbt', 'snowflake',
    ];
    return commonSkills.filter((skill) => text.includes(skill.toLowerCase()));
  }

      /**
       * Check bookmark status for multiple jobs
       */
      async checkBookmarked(userId: string, ids?: string[]): Promise<Record<string, boolean>> {
        if (!ids || !Array.isArray(ids)) return {};
        const validIds = ids.filter((id): id is string => id != null && id !== '');
        if (validIds.length === 0) return {};

        const jobs = await this.prisma.job.findMany({
          where: { id: { in: validIds }, userId },
          select: { id: true, isBookmarked: true },
        });

        const result: Record<string, boolean> = {};
        for (const id of validIds) {
          const job = jobs.find(j => j.id === id);
          result[id] = job?.isBookmarked || false;
        }
        return result;
      }

      /**
       * Bookmark/unbookmark a job
       */
  async toggleBookmark(id: string, userId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.prisma.job.update({
      where: { id },
      data: { isBookmarked: !job.isBookmarked },
    });
  }

  /**
   * Add tags to a job
   */
  async addTags(id: string, userId: string, tags: string[]) {
    const job = await this.prisma.job.findFirst({
      where: { id, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const newTags = [...new Set([...(job.tags || []), ...tags])];

    return this.prisma.job.update({
      where: { id },
      data: { tags: newTags },
    });
  }

  /**
   * Remove a tag from a job
   */
  async removeTag(id: string, userId: string, tag: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const newTags = (job.tags || []).filter((t) => t !== tag);

    return this.prisma.job.update({
      where: { id },
      data: { tags: newTags },
    });
  }

  /**
   * Mark job as applied
   */
  async markAsApplied(id: string, userId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.prisma.job.update({
      where: { id },
      data: { appliedAt: new Date() },
    });
  }

  /**
   * Map unexpected AI failures to 502 Bad Gateway. Existing HttpExceptions
   * (e.g. 404 NotFoundException) are returned as-is so their status survives.
   * Shares the message/exception contract with src/common/ai-gateway.ts.
   */
  private toBadGateway(error: unknown): HttpException {
    if (error instanceof HttpException) return error;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`AI request failed: ${message}`);
    return new AiUnavailableException();
  }

  /**
   * Get job match analysis between a resume and a job
   */
  async analyzeJobMatch(
    userId: string,
    jobId: string,
    resumeId: string,
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const resume = await this.prisma.resume.findFirst({
      where: { id: resumeId, userId },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    const prompt = prepareJobMatchInstructions({
      jobTitle: job.title,
      jobDescription: job.description || '',
      resumeText: resume.textContent || '',
      feedback: JSON.stringify(resume.feedback || {}),
      userSkills: this.extractSkillsFromResume(resume),
    });

    try {
      const aiResponse = await this.aiService.chat([
        { role: 'user', content: prompt },
      ]);
      return this.aiService.parseAIResponse(this.aiService.getResponseText(aiResponse));
    } catch (error) {
      throw this.toBadGateway(error);
    }
      }

      /**
       * Batch match multiple jobs against a resume - for feed ranking
       */
      async batchMatchJobs(
        userId: string,
        jobIds: string[],
        resumeId: string,
      ): Promise<any[]> {
        const jobs = await this.prisma.job.findMany({
          where: { id: { in: jobIds }, userId },
          select: { id: true, title: true, companyName: true, description: true, requirements: true },
        });

        if (jobs.length === 0) return [];

        const resume = await this.prisma.resume.findFirst({
          where: { id: resumeId, userId },
        });

        if (!resume) {
          throw new NotFoundException('Resume not found');
        }

        const prompt = prepareBatchJobMatchInstructions({
          resumeText: resume.textContent || '',
          feedback: JSON.stringify(resume.feedback || {}),
          userSkills: this.extractSkillsFromResume(resume),
          jobs: jobs.map((j) => ({
            id: j.id,
            title: j.title,
            company: j.companyName,
            description: j.description || '',
            requirements: j.requirements || '',
          })),
        });

        try {
          const aiResponse = await this.aiService.chat([
            { role: 'user', content: prompt },
          ]);
          return (this.aiService.parseAIResponse(this.aiService.getResponseText(aiResponse))) as any[];
        } catch (error) {
          throw this.toBadGateway(error);
        }
      }

      /**
   * Extract skills from resume text
   */
  private extractSkillsFromResume(resume: any): string[] {
    const text = (resume.textContent || '').toLowerCase();
    const commonSkills = [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 'c#',
      'react', 'vue', 'angular', 'next.js', 'node.js', 'express', 'django', 'fastapi',
      'spring boot', 'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform',
      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      'git', 'ci/cd', 'jenkins', 'github actions', 'gitlab ci',
      'microservices', 'distributed systems', 'system design', 'graphql', 'rest api',
      'machine learning', 'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy',
      'data engineering', 'spark', 'kafka', 'airflow', 'dbt', 'snowflake',
    ];

    return commonSkills.filter((skill) => text.includes(skill.toLowerCase()));
  }

  /**
   * Saved Searches
   */
  async createSavedSearch(userId: string, data: {
    name: string;
    keywords: string[];
    location?: string;
    jobTypes?: string[];
    remoteTypes?: string[];
    experienceLevels?: string[];
    sources?: string[];
  }) {
    return this.prisma.savedSearch.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async getSavedSearches(userId: string) {
    return this.prisma.savedSearch.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSavedSearch(id: string, userId: string, data: Partial<{
    name: string;
    keywords: string[];
    location?: string;
    jobTypes?: string[];
    remoteTypes?: string[];
    experienceLevels?: string[];
    sources?: string[];
    isActive: boolean;
  }>) {
    const search = await this.prisma.savedSearch.findFirst({
      where: { id, userId },
    });

    if (!search) {
      throw new NotFoundException('Saved search not found');
    }

    return this.prisma.savedSearch.update({
      where: { id },
      data,
    });
  }

  async deleteSavedSearch(id: string, userId: string) {
    const search = await this.prisma.savedSearch.findFirst({
      where: { id, userId },
    });

    if (!search) {
      throw new NotFoundException('Saved search not found');
    }

    await this.redis.removeSearchAlert(userId, id);

    return this.prisma.savedSearch.delete({ where: { id } });
  }

  async runSavedSearch(id: string, userId: string) {
    const search = await this.prisma.savedSearch.findFirst({
      where: { id, userId, isActive: true },
    });

    if (!search) {
      throw new NotFoundException('Saved search not found or inactive');
    }

    const result = await this.searchJobs(userId, {
      keywords: search.keywords,
      location: search.location || undefined,
      jobTypes: search.jobTypes,
      remoteTypes: search.remoteTypes,
      experienceLevels: search.experienceLevels,
      sources: search.sources,
    });

    await this.prisma.savedSearch.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });

    return result.jobs;
  }

  /**
   * Invalidate user's job search cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.redis.invalidateJobCache(userId);
  }

  /**
   * Delete all cached + DB jobs for a user (fresh start)
   */
  async clearUserJobs(userId: string): Promise<void> {
    await this.redis.invalidateJobCache(userId);
    await this.prisma.job.deleteMany({ where: { userId } });
    this.logger.log(`Cleared all jobs for user ${userId}`);
  }

  /**
   * Schedule saved search for periodic alerts
   */
  async scheduleSearchAlert(
    userId: string,
    searchId: string,
    searchName: string,
    cronExpression: string = '0 9 * * *', // Daily at 9 AM UTC
  ): Promise<void> {
    await this.searchAlertQueue.add(
      'search-alert',
      { userId, searchId, searchName, cron: cronExpression },
      { 
        repeat: { pattern: cronExpression },
        jobId: `alert:${userId}:${searchId}`,
      },
    );
    
    await this.redis.addSearchAlert(userId, searchId);
    this.logger.log(`Scheduled search alert for user ${userId}, search ${searchId} with cron: ${cronExpression}`);
  }

  /**
   * Cancel scheduled search alert
   */
  async cancelSearchAlert(userId: string, searchId: string): Promise<void> {
    await this.searchAlertQueue.remove(`alert:${userId}:${searchId}`);
    await this.redis.removeSearchAlert(userId, searchId);
    this.logger.log(`Cancelled search alert for user ${userId}, search ${searchId}`);
  }

  /**
   * Get all scheduled alerts for a user
   */
  async getScheduledAlerts(userId: string): Promise<string[]> {
    return this.redis.getUserSearchAlerts(userId);
  }

  /**
   * Trigger immediate search alert check
   */
  async triggerSearchAlert(userId: string, searchId: string): Promise<void> {
    const search = await this.prisma.savedSearch.findUnique({ where: { id: searchId } });
    if (!search || search.userId !== userId) {
      throw new NotFoundException('Saved search not found');
    }

    await this.searchAlertQueue.add('search-alert', {
      userId,
      searchId,
      searchName: search.name,
      keywords: search.keywords,
      location: search.location || undefined,
      jobTypes: search.jobTypes,
      remoteTypes: search.remoteTypes,
      experienceLevels: search.experienceLevels,
      sources: search.sources,
    }, { jobId: `alert:${userId}:${searchId}:manual` });
  }
}