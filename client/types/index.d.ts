// ============================================================================
// AI Resume Analyzer - Unified Type Definitions
// Consolidated types for both frontend (React Router) and backend (NestJS)
// ============================================================================

// ============================================================================
// Base Types
// ============================================================================

export type ResumeFormat = "pdf" | "docx" | "txt" | "html" | "linkedin";

export type TipFeedback = "helpful" | "not_helpful";

export interface AIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: ApiError;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// Auth & User Types
// ============================================================================

export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  image?: string;
  emailVerified?: boolean;
}

export interface BetterAuthRequest extends Request {
  user?: AuthUser;
}

// ============================================================================
// Resume Types
// ============================================================================

export interface ResumeBasics {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  url?: string;
  summary?: string;
  headline?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface ResumeExperience {
  id?: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  highlights?: string[];
  bullets?: string[];
  description?: string;
  technologies?: string[];
}

export interface ResumeEducation {
  id?: string;
  degree: string;
  field?: string;
  school: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  honors?: string[];
  coursework?: string[];
}

export interface ResumeSkill {
  name: string;
  level?: string;
  category?: string;
}

export interface ResumeProject {
  id?: string;
  name: string;
  description?: string;
  technologies?: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  bullets?: string[];
}

export interface ResumeCertification {
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
}

export interface ResumeLanguage {
  name?: string;
  language?: string;
  proficiency?: string;
}

export interface ResumeAward {
  name?: string;
  title?: string;
  issuer?: string;
  date?: string;
  description?: string;
}

export interface ResumePublication {
  name?: string;
  title?: string;
  publisher?: string;
  date?: string;
  url?: string;
  description?: string;
}

export interface ResumeVolunteer {
  organization: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  highlights?: string[];
}

export interface ResumeReference {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  relationship?: string;
}

export interface CustomSection {
  name?: string;
  title?: string;
  items?: unknown[];
  content?: string;
}

export interface GeneratedResume {
  basics?: ResumeBasics;
  summary?: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: (ResumeSkill | string)[];
  projects: ResumeProject[];
  certifications?: ResumeCertification[];
  languages?: ResumeLanguage[];
  awards?: ResumeAward[];
  publications?: ResumePublication[];
  volunteer?: ResumeVolunteer[];
  references?: ResumeReference[];
  customSections?: CustomSection[];
  _meta?: {
    baseResumeId?: string;
    baseJobTitle?: string;
    baseCompanyName?: string;
    createdFrom?: string;
    roleType?: string;
    description?: string;
    [key: string]: unknown;
  };
}

export interface Resume {
  id: string;
  userId: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  format?: string;
  fileUrl?: string;
  filePath?: string;
  imagePath?: string;
  textPreview?: string;
  rawText?: string;
  textContent?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  generatedContent?: GeneratedResume;
  parsedContent?: GeneratedResume;
  atsScore?: number;
  feedback?: Feedback;
  skillGapResult?: SkillGapResult;
  interviewQuestionsResult?: InterviewQuestionsResult;
  salaryEstimateResult?: SalaryRangeResult;
  templateSuggestionsResult?: ResumeTemplateSuggestionsResult;
  multiJdResult?: MultiJdResult;
  tailoredResumeResult?: TailoredResumeResult;
  tipFeedback?: Record<string, 'up' | 'down'>;
  sharedFeedbacks?: SharedFeedback[];
  isPrimary?: boolean;
  shareToken?: string;
  applicationStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeParseResult {
  text: string;
  sections: Record<string, string>;
  format: ResumeFormat;
  html?: string;
}

export interface FeedbackTip {
  type: "good" | "improve";
  tip: string;
  explanation: string;
}

export interface ATSTip {
  tip: string;
}

export interface FeedbackCategory {
  score: number;
  tips: FeedbackTip[];
}

export interface ATSFeedback {
  score: number;
  tips: ATSTip[];
}

export interface Feedback {
  overallScore: number;
  ATS: ATSFeedback;
  toneAndStyle: FeedbackCategory;
  content: FeedbackCategory;
  structure: FeedbackCategory;
  skills: FeedbackCategory;
  keywordMatches?: string[];
  keywordGaps?: string[];
  keywordMatchScore?: number;
  formatScore?: number;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  name: string;
  roleType: string;
  content: GeneratedResume;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeVersionContent extends GeneratedResume {
  id: string;
  resumeId: string;
  name: string;
  roleType: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Resume Request/Response Types
// ============================================================================

export interface ResumeContentUpdateRequest {
  parsedContent?: GeneratedResume;
  generatedContent?: GeneratedResume;
  contactInfo?: Record<string, string>;
}

export interface ResumeVersionCreateRequest {
  name: string;
  roleType: string;
  content: GeneratedResume;
  description?: string;
  isPrimary?: boolean;
}

export interface ResumeVersionUpdateRequest {
  name?: string;
  roleType?: string;
  content?: GeneratedResume;
  isPrimary?: boolean;
}

export interface ResumeGenerateRequest {
  targetRole?: string;
  jobDescription?: string;
  companyName?: string;
}

export interface ResumeTailorRequest {
  resumeId?: string;
  jobId?: string;
  jobDescription: string;
  targetRole?: string;
}

export interface ResumeTailorResponse {
  tailoredContent: GeneratedResume;
  changes: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  keywordMatches: string[];
  keywordGaps: string[];
  matchScore: number;
}

export interface TailoredResumeResult {
  tailoredContent: GeneratedResume;
  tailoredResume?: GeneratedResume;
  newResumeId?: string;
  textContent?: string;
  jobId?: string;
  changes: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  keywordMatches: string[];
  keywordGaps: string[];
  matchScore: number;
}

export interface TailoredResume {
  id: string;
  userId: string;
  jobId?: string;
  resumeId: string;
  tailoredContent: GeneratedResume;
  matchScore: number;
  keywordMatches: string[];
  keywordGaps: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Cover Letter Types
// ============================================================================

export interface CoverLetter {
  id: string;
  userId?: string;
  resumeId?: string;
  jobId?: string;
  content: string;
  companyName?: string;
  hiringManager?: string;
  variables?: Record<string, string>;
  additionalContext?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CoverLetterTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  content?: string;
  template?: string;
  variables: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetterTemplateCreateRequest {
  name: string;
  description?: string;
  content?: string;
  template?: string;
  variables?: string[];
  isDefault?: boolean;
}

export interface CoverLetterTemplateUpdateRequest {
  name?: string;
  content?: string;
  variables?: string[];
  isDefault?: boolean;
}

export interface CoverLetterTemplateApplyRequest {
  templateId?: string;
  variables: Record<string, string>;
}

// ============================================================================
// Job Types
// ============================================================================

export interface ExternalJobPosting {
  id: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  company?: string;
  companyId?: string;
  companySize?: string;
  companyRating?: number;
  companyReviewCount?: number;
  name?: string;
  logoUrl?: string;
  location: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  jobType?: string;
  remoteType?: string;
  experienceLevel?: string;
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
  benefitsExtended?: string;
  softSkills?: string;
  source: string;
  sources?: string;
  sourceUrl: string;
  postedAt: string;
  expiresAt?: string;
  isBookmarked?: boolean;
  tags?: string[];
  appliedAt?: string;
  rating?: number;
  reviewCount?: number;
  size?: string;
  matchScore?: number;
  type?: string;
}

export interface Job {
  id: string;
  userId: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  location: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  jobType?: string;
  remoteType?: string;
  experienceLevel?: string;
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
  benefitsExtended?: string;
  softSkills?: string;
  source: string;
  sourceUrl: string;
  postedAt: string;
  expiresAt?: string;
  isBookmarked: boolean;
  appliedAt?: string;
  tags: string[];
  externalData?: Record<string, unknown>;
  type?: string;
  matchScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobSearchParams {
  keywords?: string;
  location?: string;
  jobTypes?: string[];
  remoteTypes?: string[];
  experienceLevels?: string[];
  sources?: string[];
  page?: number;
  limit?: number;
}

export interface JobSearchResult {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JobListResult {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JobDetailsResponse {
  job: Job;
  skillMatch?: {
    percentage: number;
    matchedSkills: string[];
    missingSkills: string[];
  };
  skillGap?: SkillGapResult;
  resumeId?: string;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  keywords: string[];
  location?: string;
  jobTypes?: string[];
  remoteTypes?: string[];
  experienceLevels?: string[];
  sources?: string[];
  isActive: boolean;
  frequency?: string;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobMatchResult {
  jobId: string;
  matchScore: number;
  score?: number;
  title?: string;
  company?: string;
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
}

export interface BookmarkCheckRequest {
  ids: string[];
}

// ============================================================================
// Skill Gap Types
// ============================================================================

export interface SkillGapCourseRecommendation {
  title: string;
  type: "course" | "article" | "project" | "certification" | "documentation";
  description: string;
  duration?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface SkillGapMissingSkill {
  skill: string;
  importance: "critical" | "important" | "nice-to-have";
  recommendations: SkillGapCourseRecommendation[];
}

export interface SkillGapRecommendation {
  skill: string;
  priority: "high" | "medium" | "low";
  reason: string;
  resources: string[];
}

export interface SkillGapItem {
  skill: string;
  required: boolean;
  proficiency?: string;
  inResume: boolean;
  gap: boolean;
}

export interface SkillGapResult {
  totalScore: number;
  presentSkills: string[];
  missingSkills: SkillGapMissingSkill[];
  summary: string;
  matchedSkills: string[];
  overallMatch: number;
}

// ============================================================================
// Interview Questions Types
// ============================================================================

export interface InterviewQuestion {
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  expectedAnswerPoints: string[];
  followUpQuestions?: string[];
  talkingPoints: string[];
  whatInterviewerLooksFor: string;
}

export interface InterviewQuestionsResult {
  questions: InterviewQuestion[];
  categories: string[];
  totalCount: number;
  confidence: number;
  preparationTips: string[];
  keyTopicsToReview: string[];
}

// ============================================================================
// Salary Types
// ============================================================================

export interface SalaryPercentile {
  percentile: number;
  value: number;
}

export interface SalaryEstimatedRange {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface SalaryLocationAdjustment {
  location: string;
  adjustment: string;
  range: SalaryEstimatedRange;
}

export interface SalaryRangeResult {
  role: string;
  location: string;
  experienceLevel: string;
  estimatedRange: SalaryEstimatedRange;
  currency: string;
  currencySymbol: string;
  period: "yearly" | "monthly" | "hourly";
  marketLevel: "below-market" | "market" | "above-market";
  confidence: "low" | "medium" | "high";
  factors: string[];
  locationAdjustments?: SalaryLocationAdjustment[];
  summary: string;
  percentiles: SalaryPercentile[];
  median: number;
  mean: number;
  source: string;
  lastUpdated: string;
  sampleSize: number;
}

// ============================================================================
// Multi-JD Comparison Types
// ============================================================================

export interface MultiJdEntry {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements?: string;
}

export interface MultiJdCategoryScore {
  score: number;
  tips: { type: string; tip: string; explanation?: string }[];
}

export interface MultiJdComparison {
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  overallScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
  ATS: MultiJdCategoryScore;
  toneAndStyle: MultiJdCategoryScore;
  content: MultiJdCategoryScore;
  structure: MultiJdCategoryScore;
  skills: MultiJdCategoryScore;
}

export interface MultiJdResult {
  resumeId: string;
  comparisons: MultiJdComparison[];
  overallBestMatch?: MultiJdComparison;
  bestMatch: string;
  recommendation: string;
  summary: string;
}

// ============================================================================
// Template Suggestions Types
// ============================================================================

export interface TemplateSuggestion {
  name: string;
  description: string;
  atsScore: number;
  bestFor: string[];
  keyFeatures: string[];
  sectionOrder: string[];
  designTips: string[];
}

export interface ResumeTemplateSuggestionsResult {
  currentTemplateScore: number;
  currentTemplateAnalysis: string;
  suggestions: TemplateSuggestion[];
  customizationTips: string[];
  summary: string;
  recommendations: TemplateSuggestion[];
  generalTips: string[];
}

// ============================================================================
// Share Types
// ============================================================================

export interface SharedFeedback {
  id: string;
  name: string;
  comment: string;
  rating?: number | null;
  createdAt: string;
}

export interface SharedReport {
  id: string;
  type: string;
  title: string;
  data: unknown;
  createdAt: string;
  userId?: string;
  resumeId?: string;
  jobId?: string;
  reportType?: "ats" | "skill_gap" | "interview_questions" | "salary" | "multi_jd" | "template" | "tailored_resume";
  expiresAt?: string;
  jobTitle?: string;
  companyName?: string;
  imagePath?: string;
  feedback?: unknown;
  generatedContent?: GeneratedResume;
  textContent?: string;
  sharedFeedbacks?: SharedFeedback[];
}

// ============================================================================
// LinkedIn Types
// ============================================================================

export interface ExperienceImprovement {
  original: string;
  improved: string;
  reason: string;
}

export interface SkillRecommendation {
  skill: string;
  category: string;
  priority: "high" | "medium" | "low";
  reason: string;
}

export interface ContentStrategyItem {
  section: string;
  current: string;
  recommended: string;
  reason: string;
}

export interface LinkedInProfileAnalysis {
  headline: {
    score: number;
    feedback: string;
    suggestions: string[];
  };
  about: {
    score: number;
    feedback: string;
    suggestions: string[];
  };
  experience: ExperienceImprovement[];
  skills: SkillRecommendation[];
  contentStrategy: ContentStrategyItem[];
  overallScore: number;
  summary: string;
}

export interface LinkedInProfile {
  id: string;
  userId: string;
  headline?: string;
  about?: string;
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
  analysis?: LinkedInProfileAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedInExperience {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface LinkedInEducation {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  grade?: string;
}

export interface LinkedInProfileListItem {
  id: string;
  headline?: string;
  experienceCount: number;
  skillsCount: number;
  createdAt: string;
}

// ============================================================================
// Reference Types
// ============================================================================

export interface Reference {
  id: string;
  userId: string;
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  relationship: string;
  yearsKnown?: number;
  notes?: string;
  status: "not_contacted" | "contacted" | "agreed" | "declined";
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Portfolio Types
// ============================================================================

export interface Project {
  id: string;
  userId: string;
  name: string;
  title: string;
  description: string;
  technologies: string[];
  url?: string;
  projectUrl?: string;
  demoUrl?: string;
  githubUrl?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  featured: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Company Types
// ============================================================================

export interface Company {
  id: string;
  name: string;
  logo?: string;
  logoUrl?: string;
  website?: string;
  description?: string;
  industry?: string;
  size?: string;
  headquarters?: string;
  founded?: number;
  foundedYear?: number;
  domain?: string;
  type?: string;
  ceo?: string;
  employeeCount?: number;
  revenue?: number;
  salaryRanges?: Array<{ role: string; min: number; max: number; median: number }>;
  interviewInsights?: Array<{ type: string; difficulty: string; tips: string[] }>;
  glassdoorRating?: number;
  glassdoorReviews?: number;
  glassdoorReviewCount?: number;
  glassdoorPros?: string[];
  glassdoorCons?: string[];
  cultureRating?: number;
  diversityRating?: number;
  workLifeBalanceRating?: number;
  compensationRating?: number;
  careerOpportunitiesRating?: number;
  ceoApprovalRating?: number;
  recentNews?: CompanyNews[];
  financials?: CompanyFinancials;
  competitors?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyNews {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
}

export interface CompanyFinancials {
  revenue?: number;
  employees?: number;
  funding?: CompanyFunding[];
  valuation?: number;
  ipoDate?: string;
}

export interface CompanyFunding {
  round: string;
  amount: number;
  date: string;
  investors?: string[];
}

export interface CompanyBriefing {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  roleTitle: string;
  mission: string;
  products: string[];
  competitors: CompanyCompetitor[];
  culture: CompanyCulture;
  recentNews: CompanyNews[];
  financials: CompanyFinancials;
  interviewInsights: string[];
  questionsToAsk: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyCompetitor {
  name: string;
  description: string;
  differentiator: string;
}

export interface CompanyCulture {
  values: string[];
  workEnvironment: string;
  benefits: string[];
  diversityInclusion: string;
}

// ============================================================================
// Interview Prep Types
// ============================================================================

export interface TechnicalAssessment {
  id: string;
  userId?: string;
  companyId?: string;
  companyName?: string;
  roleTitle: string;
  difficulty?: string;
  questions: TechnicalQuestion[];
  codingChallenges?: Array<{ title: string; description: string; difficulty: string; hints?: string[]; priority?: string; category?: string; tags?: string[]; constraints?: string[]; examples?: Array<{ input: string; output: string; explanation?: string }> }>;
  systemDesignPrompts?: Array<{ title: string; description: string; difficulty: string; priority?: string; category?: string; requirements?: string[]; keyConsiderations?: string[] }>;
  takeHomeSimulations?: Array<{ title: string; description: string; difficulty?: string; timeLimit?: number; priority?: string; category?: string; tasks?: string[]; deliverables?: string[] }>;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  expectedAnswer: string;
  hints?: string[];
  timeLimit?: number;
}

export interface BehavioralSTARQuestion {
  competency: string;
  question: string;
  difficulty?: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  star?: { situation: string; task: string; action: string; result: string };
  tips: string[];
}

export interface BehavioralQuestionBank {
  id: string;
  userId?: string;
  companyId?: string;
  companyName?: string;
  roleTitle: string;
  competencies?: string[];
  questions: BehavioralSTARQuestion[] | Record<string, BehavioralSTARQuestion[]>;
  preparationTips?: string[];
  summary?: string;
  overallScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MockInterviewMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  score?: number;
  feedback?: string;
  timestamp: string;
}

export interface MockInterviewSession {
  id: string;
  userId: string;
  companyId?: string;
  companyName: string;
  roleTitle: string;
  type: "behavioral" | "technical" | "mixed";
  status: "not_started" | "in_progress" | "completed" | "paused";
  messages: MockInterviewMessage[];
  totalQuestions: number;
  currentQuestionIndex: number;
  overallScore?: number;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewCheatSheet {
  id: string;
  userId: string;
  companyId?: string;
  companyName: string;
  roleTitle: string;
  talkingPoints: string[];
  questionsToAsk: string[];
  salaryRange?: SalaryRangeResult;
  keyAchievements: string[];
  technicalTopics: string[];
  behavioralThemes: string[];
  companyInsights: string[];
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the persisted InterviewSchedule row (prisma/schema.prisma). */
export interface InterviewScheduleEntry {
  id: string;
  userId: string;
  applicationId?: string | null;
  companyName: string;
  roleTitle: string;
  interviewType: string;
  scheduledAt: string;
  duration: number;
  timezone: string;
  location?: string | null;
  meetingLink?: string | null;
  interviewerNames: string[];
  prepTimeBlock?: number | null;
  notes?: string | null;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  reminders: Array<{ type: string; minutesBefore: number; sent: boolean }>;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewerInfo {
  name: string;
  title?: string;
  email?: string;
  linkedin?: string;
}

export interface InterviewPrep {
  id: string;
  userId: string;
  companyId?: string;
  companyName: string;
  roleTitle: string;
  briefing?: CompanyBriefing;
  technicalAssessments: TechnicalAssessment[];
  behavioralBanks: BehavioralQuestionBank[];
  mockInterviews: MockInterviewSession[];
  cheatSheets: InterviewCheatSheet[];
  schedules: InterviewScheduleEntry[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Interview Process Types
// ============================================================================

export interface InterviewNote {
  id: string;
  userId: string;
  applicationId?: string | null;
  scheduleId?: string | null;
  companyName: string;
  roleTitle: string;
  interviewType: string;
  roundNumber: number;
  questionsAsked: InterviewQA[];
  selfRating: number;
  strengths: string[];
  weaknesses: string[];
  followUpItems: string[];
  generalNotes?: string | null;
  interviewDate: string;
  createdAt: string;
  updatedAt: string;
  feedbacks?: InterviewerFeedback[];
}

/** Mirrors the questionsAsked JSON entries on InterviewNote. */
export interface InterviewQA {
  question: string;
  category?: string;
  myAnswer?: string;
  rating?: number;
}

export interface InterviewerFeedback {
  id: string;
  userId: string;
  applicationId: string;
  round: number;
  interviewer: string;
  interviewerRole?: string;
  rating?: number;
  strengths: string[];
  concerns: string[];
  hireRecommendation?: "strong_hire" | "hire" | "no_hire" | "strong_no_hire";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpEmail {
  id: string;
  userId: string;
  applicationId?: string | null;
  interviewNoteId?: string | null;
  type: string;
  subject: string;
  body: string;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PanelInterview {
  id: string;
  userId: string;
  applicationId?: string;
  companyName?: string;
  roleTitle?: string;
  scheduledAt: string;
  duration: number;
  interviewers: PanelInterviewer[];
  status?: string;
  consolidatedFeedback?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PanelInterviewer {
  name: string;
  title?: string;
  role?: string;
  email?: string;
  feedback?: string;
  rating?: number;
}

export interface CaseStudy {
  id: string;
  userId?: string;
  applicationId?: string;
  companyName?: string;
  roleTitle?: string;
  company?: string;
  role?: string;
  title: string;
  description: string;
  problem?: string;
  approach?: string;
  requirements: string[];
  solution: string;
  technologies?: string[];
  results?: string;
  challenges?: string;
  learnings?: string;
  slides?: Array<{ title: string; content: string; notes?: string; layout?: string }>;
  presentationUrl?: string;
  notes?: string;
  aiAssisted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface InterviewPerformanceAnalytics {
  totalInterviews: number;
  totalApplications?: number;
  screensCount?: number;
  interviewsCount?: number;
  offersCount?: number;
  interviewsByType: Record<string, number>;
  interviewsByStage: Record<string, number>;
  averageRating: number;
  selfRatingAverage?: number;
  strongAreas: string[];
  weakAreas: string[];
  conversionRates: Record<string, number>;
  trends: InterviewTrend[];
  byType?: Array<{ type: string; count: number; avgRating: number; conversions: number }>;
  recentNotes?: InterviewNote[];
}

export interface InterviewTrend {
  date: string;
  metric: string;
  value: number;
}

// ============================================================================
// Offer & Negotiation Types
// ============================================================================

export interface OfferItem {
  id: string;
  userId: string;
  applicationId?: string;
  companyName: string;
  roleTitle: string;
  baseSalary: number;
  currency: string;
  bonus?: number;
  equity?: OfferEquity;
  benefits: OfferBenefits;
  location: string;
  remotePolicy: string;
  startDate?: string;
  expiresAt?: string;
  status: "pending" | "accepted" | "rejected" | "negotiating";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferEquity {
  type: "RSU" | "ISO" | "NSO" | "options" | "shares";
  amount: number;
  vestingSchedule: VestingSchedule;
  currentPrice?: number;
  strikePrice?: number;
}

export interface VestingSchedule {
  cliffMonths: number;
  totalMonths: number;
  frequency: "monthly" | "quarterly" | "annual";
}

export interface OfferBenefits {
  healthInsurance?: string;
  dentalInsurance?: string;
  visionInsurance?: string;
  lifeInsurance?: string;
  disabilityInsurance?: string;
  retirementPlan?: string;
  employerMatch?: string;
  espnPlan?: boolean;
  ptoDays?: number;
  sickDays?: number;
  holidays?: number;
  parentalLeave?: string;
  remoteWork?: string;
  flexibleHours?: boolean;
  professionalDevelopment?: string;
  wellness?: string;
  other?: string[];
}

/**
 * One offer entry inside an OfferComparison row's `offers` JSON. Created by
 * the offer-comparison form; a comparison aggregates several of these.
 */
export interface ComparisonOfferEntry {
  name: string;
  baseSalary: number;
  equity: number;
  bonus: number;
  location: string;
  remotePolicy: string;
  benefits: string;
  pto: number;
  growthOpportunities: number;
  companyCulture: number;
}

/** A persisted OfferComparison row as returned by the offer-negotiation API. */
export interface OfferComparisonRow {
  id: string;
  userId: string;
  applicationId?: string | null;
  name: string;
  offers: ComparisonOfferEntry[];
  weights: Record<string, number>;
  scores: Array<{ offerName: string; totalScore: number; criterionScores: Array<{ criterion: string; score: number; maxScore: number; notes: string }> }> | null;
  recommendation?: string | null;
  application?: {
    id: string;
    companyName: string;
    roleTitle: string;
    status: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Did not match any persisted server shape; use OfferComparisonRow. */
export interface OfferComparisonItem {
  offerId: string;
  companyName: string;
  roleTitle: string;
  totalComp: number;
  baseSalary: number;
  bonus: number;
  equityValue: number;
  benefitsScore: number;
  locationScore: number;
  growthScore: number;
  cultureScore: number;
  wlbScore: number;
  overallScore: number;
  growthOpportunities?: string | number;
}

export interface OfferScore {
  offerId: string;
  companyName: string;
  roleTitle: string;
  totalComp: number;
  baseSalary: number;
  bonus: number;
  equityValue: number;
  benefitsScore: number;
  locationScore: number;
  growthScore: number;
  cultureScore: number;
  wlbScore: number;
  overallScore: number;
}

/**
 * Mirrors the NegotiationCoach rows persisted by OfferNegotiationService:
 * AI-parsed strategy content plus the optional link back to the application
 * the negotiation belongs to.
 */
export interface NegotiationCoach {
  id: string;
  userId: string;
  applicationId?: string | null;
  companyName: string;
  roleTitle: string;
  offerDetails?: {
    baseSalary: number;
    equity?: number;
    equityType?: string;
    bonus?: number;
    signOn?: number;
    benefits?: string[];
  };
  marketData?: MarketData | null;
  strategy?: {
    overallApproach: string;
    anchorPoint: number;
    targetPoint: number;
    walkAwayPoint: number;
    keyLeveragePoints?: string[];
    stepByStep?: Array<{ step: number; action: string; script?: string; tip?: string }>;
  } | null;
  emailTemplates?: Array<{
    type?: string;
    subject: string;
    body: string;
  }> | null;
  scripts?: NegotiationScript[];
  application?: {
    id: string;
    companyName: string;
    roleTitle: string;
    status: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketData {
  role: string;
  location: string;
  experienceLevel: string;
  percentiles: SalaryPercentile[];
  sources: string[];
}

/** Mirrors the scripts[] entries requested by buildNegotiationCoachPrompt. */
export interface NegotiationScript {
  scenario: string;
  opening: string;
  keyPoints: string[];
  closing: string;
  handlingObjections?: string[];
}

export interface CounterOffer {
  item: string;
  currentValue: number;
  requestedValue: number;
  justification: string;
}

export interface NegotiationEmail {
  type: "counter_offer" | "benefits_request" | "equity_request" | "start_date" | "other";
  subject: string;
  body: string;
  sent: boolean;
  sentAt?: string;
}

export interface EquityCalculationResult {
  grantValue: number;
  vestingSchedule: VestingSchedule;
  scenarios: EquityScenario[];
  taxImplications: TaxImplication[];
}

export interface EquityScenario {
  name: string;
  exitValue: number;
  ownershipPercent: number;
  payout: number;
  taxOwed: number;
  netProceeds: number;
}

export interface TaxImplication {
  event: string;
  description: string;
  estimatedTax: number;
  timing: string;
}

export interface BenefitsAnalysisResult {
  totalValue: number;
  totalCompensationValue?: number;
  overallScore?: number;
  summary?: string;
  breakdown: BenefitBreakdown[];
  comparison: BenefitComparison[];
  categories?: Array<{ name: string; score: number; items: { name: string; value: string; marketBenchmark: string; rating: string; notes?: string }[] }>;
  strengths?: string[];
  weaknesses?: string[];
  missingComparedToMarket?: string[];
  recommendations: string[];
}

export interface BenefitBreakdown {
  category: string;
  employerCost: number;
  employeeValue: number;
  details: string;
}

export interface BenefitComparison {
  category: string;
  yourOffer: string;
  marketAverage: string;
  difference: number;
  strengths?: string[];
  weaknesses?: string[];
  missingComparedToMarket?: string[];
}

export interface DecisionCriterion {
  name: string;
  weight: number;
  score: number;
  reasoning: string;
}

export interface OfferDecision {
  id: string;
  userId: string;
  offerIds: string[];
  criteria: DecisionCriterion[];
  scores: Record<string, number>;
  recommendation: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResignationLetter {
  id: string;
  userId: string;
  currentCompany: string;
  lastDay: string;
  reason: string;
  tone: "professional" | "grateful" | "neutral" | "brief";
  content: string;
  transitionPlan?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Application Tracker Types
// ============================================================================

export type ApplicationStatus =
  | "draft"
  | "applied"
  | "phone_screen"
  | "interviewing"
  | "offer"
  | "rejected"
  | "accepted"
  | "withdrawn";

export interface JobApplication {
  id: string;
  userId: string;
  jobId?: string;
  job?: { id?: string; source?: string; sourceUrl?: string; companyName?: string; title?: string } | null;
  companyName: string;
  roleTitle: string;
  status: ApplicationStatus;
  stage?: string;
  appliedAt?: string;
  resumeId?: string;
  coverLetterId?: string;
  tailoredResumeId?: string;
  source?: string;
  referrer?: string;
  referralContact?: string;
  notes?: string;
  nextSteps?: string;
  nextActionAt?: string;
  nextActionNote?: string;
  referral?: ReferralRequest | null;
  communications?: CommunicationLog[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationLog {
  id: string;
  userId?: string;
  applicationId: string;
  type: string;
  direction?: string;
  contactName?: string;
  contactEmail?: string;
  subject?: string;
  content: string;
  occurredAt: string;
  outcome?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReferralRequest {
  id: string;
  userId?: string;
  applicationId: string;
  employeeName: string;
  employeeEmail?: string;
  employeeLinkedIn?: string;
  referrerName?: string;
  referrerEmail?: string;
  referrerLinkedIn?: string;
  relationship?: string;
  status: string;
  notes?: string;
  requestedAt?: string;
  respondedAt?: string;
  submittedAt?: string;
  thankedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationsAnalytics {
  totalApplications: number;
  applicationsByStatus: Record<ApplicationStatus, number>;
  applicationsByMonth: Array<{ month: string; count: number }>;
  topStrengths: Array<{ skill: string; count: number }>;
  topWeaknesses: Array<{ skill: string; count: number }>;
  conversionRate: number;
  averageTimeToOffer: number;
  interviewsByStage: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  salaryOffers: Array<{ company: string; baseSalary: number; totalComp: number }>;
  timeline: Array<{ date: string; event: string; company: string }>;
  byType?: Record<string, { count: number; avgRating: number }>;
  byCompany?: Record<string, { count: number; avgRating: number }>;
  strengthFrequency?: Record<string, number>;
  weaknessFrequency?: Record<string, number>;
  feedbackSummary?: {
    totalFeedbacks: number;
    averageRating: number;
    recommendationCounts: Record<string, number>;
  };
}

// ============================================================================
// Post-Onboarding Types
// ============================================================================

export interface OnboardingPlan {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  startDate: string;
  milestones: OnboardingMilestone[];
  learningGoals: LearningGoal[];
  stakeholders: Stakeholder[];
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingMilestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  completed: boolean;
  completedAt?: string;
  category: "learning" | "meeting" | "delivery" | "admin";
}

export interface LearningGoal {
  id: string;
  title: string;
  description: string;
  resources: string[];
  targetDate: string;
  completed: boolean;
  completedAt?: string;
}

export interface Stakeholder {
  id: string;
  name: string;
  title: string;
  department: string;
  role: "manager" | "peer" | "cross_functional" | "leadership" | "support";
  meetingFrequency: string;
  notes?: string;
}

export interface OnboardingChecklist {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  startDate: string;
  categories: ChecklistCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistCategory {
  id: string;
  name: string;
  order: number;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  dueDate?: string;
  assignee?: string;
  priority: "high" | "medium" | "low";
}

export interface ManagerAlignment {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  managerName: string;
  managerTitle: string;
  successMetrics: SuccessMetric[];
  communicationPreferences: CommunicationPreferences;
  meetingCadence: MeetingCadence;
  createdAt: string;
  updatedAt: string;
}

export interface SuccessMetric {
  id: string;
  name: string;
  description: string;
  target: string;
  timeframe: string;
  measurable: boolean;
}

export interface CommunicationPreferences {
  preferredChannels: string[];
  responseTimeExpectation: string;
  updateFrequency: string;
  escalationPath: string;
}

export interface MeetingCadence {
  oneOnOne: string;
  teamMeeting: string;
  skipLevel: string;
  stakeholderSync: string;
}

export interface NetworkMap {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  contacts: NetworkContact[];
  coffeeChats: CoffeeChat[];
  relationshipMap?: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkContact {
  id: string;
  name: string;
  title: string;
  department: string;
  importance: string;
  role?: string;
  meetingGoal?: string;
  relationship: "manager" | "peer" | "mentor" | "cross_functional" | "leadership" | "support";
  email?: string;
  linkedin?: string;
  notes?: string;
  lastInteraction?: string;
  nextAction?: string;
  nextActionDate?: string;
}

export interface CoffeeChat {
  id: string;
  contactId: string;
  contactName?: string;
  scheduledAt: string;
  suggestedTimeframe?: string;
  agenda?: string;
  questions?: string[];
  completed: boolean;
  notes?: string;
  topics?: string[];
}

export interface SkillRefresh {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  learningPath: LearningPathItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningPathItem {
  id: string;
  skill: string;
  category: string;
  priority: "critical" | "important" | "nice_to_have";
  currentLevel: number;
  targetLevel: number;
  resources: LearningResource[];
  estimatedHours: number;
  completed: boolean;
  completedAt?: string;
}

export interface LearningResource {
  title: string;
  type: "course" | "book" | "article" | "video" | "documentation" | "practice";
  url?: string;
  estimatedHours: number;
  cost?: number;
}

export interface First90DaysTracker {
  id: string;
  userId: string;
  applicationId?: string | null;
  companyName: string;
  roleTitle: string;
  startDate: string;
  milestones: First90Phase[];
  feedbackLoops: First90FeedbackLoop[];
  earlyWins: First90EarlyWin[];
  currentPhase?: string;
  overallProgress?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shapes match what buildFirst90DaysPrompt (server/src/post-onboarding/prompts.ts)
 * requests from the AI and what createTracker persists: phase-grouped
 * milestones (learning → contributing → leading), feedback loops, early wins.
 */
export interface First90Phase {
  phase: "learning" | "contributing" | "leading";
  timeframe?: string;
  goals?: string[];
  deliverables?: string[];
  successCriteria?: string[];
}

export interface First90FeedbackLoop {
  type: string;
  frequency?: string;
  participants?: string[];
  purpose?: string;
}

export interface First90EarlyWin {
  opportunity: string;
  impact?: "high" | "medium" | "low";
  effort?: "high" | "medium" | "low";
  timeframe?: string;
  steps?: string[];
}

// ============================================================================
// User Profile Types
// ============================================================================

export interface UserProfile {
  id: string;
  userId: string;
  name?: string;
  email?: string;
  education: ProfileEducation[];
  experience: ProfileExperience[];
  projects: ProfileProject[];
  skills: string[];
  certifications: ProfileCertification[];
  languages: string[];
  headline?: string;
  summary?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  phone?: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileCompletion {
  percentage: number;
  missingFields: string[];
}

// ============================================================================
export interface ProfileEducation {
  degree: string;
  field?: string;
  school: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
}

export interface ProfileExperience {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  highlights?: string[];
  description?: string;
}

export interface ProfileProject {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
}

export interface ProfileCertification {
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
}

// ============================================================================
// Batch Types
// ============================================================================

export interface Batch {
  id: string;
  userId: string;
  name?: string;
  jobTitle: string;
  jobDescription?: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalResumes?: number;
  processedResumes?: number;
  resumes?: BatchResume[];
  createdAt: string;
  updatedAt?: string;
}

export interface BatchResume {
  id: string;
  batchId: string;
  resumeId: string;
  fileName: string;
  format?: string;
  imagePath?: string;
  textPreview?: string;
  status: "pending" | "processing" | "completed" | "failed";
  atsScore?: number;
  feedback?: Feedback;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchCreateRequest {
  name: string;
  jobDescription?: string;
  resumeIds: string[];
}

export interface BatchItemResponse {
  id: string;
  jobTitle: string;
  jobDescription?: string;
  resumeIds: string[];
  createdAt: string;
  resumes: BatchResume[];
}

export interface BatchCreateResponse {
  batch: Batch;
  uploadUrls: string[];
}

// ============================================================================
// Request/Response Types for API
// ============================================================================

export interface JobSearchRequest {
  keywords?: string;
  location?: string;
  jobTypes?: string[];
  remoteTypes?: string[];
  experienceLevels?: string[];
  jobFunctions?: string[];
  sources?: string[];
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

export interface JobListRequest {
  source?: string;
  isBookmarked?: boolean;
  search?: string;
  status?: string;
  jobType?: string;
  remoteType?: string;
  experienceLevel?: string;
  jobFunction?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

export interface JobBookmarkRequest {
  jobId: string;
}

export interface JobTagsRequest {
  jobId: string;
  tags: string[];
}

export interface JobMatchRequest {
  resumeId: string;
}

export interface BatchMatchRequest {
  jobIds: string[];
  resumeId: string;
}

export interface SavedSearchCreateRequest {
  name: string;
  keywords: string[];
  location?: string;
  jobTypes?: string[];
  remoteTypes?: string[];
  experienceLevels?: string[];
  sources?: string[];
  isActive?: boolean;
}

export interface SavedSearchUpdateRequest {
  name?: string;
  keywords?: string[];
  location?: string;
  jobTypes?: string[];
  remoteTypes?: string[];
  experienceLevels?: string[];
  sources?: string[];
  isActive?: boolean;
}

export interface ApplicationCreateRequest {
  jobId?: string;
  companyName: string;
  roleTitle: string;
  status?: ApplicationStatus;
  resumeId?: string;
  coverLetterId?: string;
  source?: string;
  referrer?: string;
  notes?: string;
}

export interface ApplicationUpdateRequest {
  companyName?: string;
  roleTitle?: string;
  status?: ApplicationStatus;
  stage?: string;
  resumeId?: string;
  coverLetterId?: string;
  source?: string;
  referrer?: string;
  notes?: string;
  nextActionAt?: string;
  nextActionNote?: string;
}

export interface ApplicationStatusUpdateRequest {
  status: ApplicationStatus;
  stage?: string;
}

export interface CommunicationLogCreateRequest {
  applicationId: string;
  type: "email" | "call" | "message" | "meeting" | "other";
  direction: "inbound" | "outbound";
  contactName?: string;
  contactEmail?: string;
  subject?: string;
  content: string;
  occurredAt: string;
}

export interface ReferralUpsertRequest {
  applicationId: string;
  referrerName: string;
  referrerEmail?: string;
  referrerLinkedIn?: string;
  relationship: string;
  status?: "requested" | "agreed" | "declined" | "submitted" | "thanked";
  notes?: string;
}

export interface ApplicationAnalyticsRequest {
  startDate?: string;
  endDate?: string;
}

export interface CompanyBriefingRequest {
  companyName: string;
  roleTitle?: string;
  jobDescription?: string;
  resumeText?: string;
}

export interface TechnicalAssessmentRequest {
  companyName?: string;
  roleTitle?: string;
  companyId?: string;
  jobDescription?: string;
  resumeText?: string;
  targetDifficulty?: string;
  focusAreas?: string;
}

export interface BehavioralBankRequest {
  companyName?: string;
  roleTitle?: string;
  companyId?: string;
  jobDescription?: string;
  resumeText?: string;
  competencies?: string[];
  questionCount?: number;
}

export interface MockInterviewCreateRequest {
  companyName: string;
  roleTitle: string;
  type: "behavioral" | "technical" | "mixed";
  companyId?: string;
}

export interface MockInterviewMessageRequest {
  sessionId: string;
  content: string;
}

export interface CheatSheetRequest {
  companyName: string;
  roleTitle: string;
  companyId?: string;
}

export interface ScheduleCreateRequest {
  applicationId?: string;
  companyName: string;
  roleTitle: string;
  interviewers?: InterviewerInfo[];
  interviewerNames?: string[];
  interviewType?: string;
  scheduledAt: string;
  duration: number;
  timezone?: string;
  type?: string;
  round?: number;
  meetingLink?: string;
  location?: string;
  preparationNotes?: string;
  notes?: string;
  status?: string;
  prepTimeBlock?: number;
  prepTimeBlocks?: Array<{ start: string; end: string; topic: string }>;
}

export interface ScheduleListRequest {
  applicationId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface ScheduleUpdateRequest {
  interviewers?: InterviewerInfo[];
  interviewerNames?: string[];
  interviewType?: string;
  scheduledAt?: string;
  duration?: number;
  timezone?: string;
  type?: string;
  round?: number;
  meetingLink?: string;
  location?: string;
  preparationNotes?: string;
  notes?: string;
  status?: string;
  prepTimeBlock?: number;
  prepTimeBlocks?: Array<{ start: string; end: string; topic: string }>;
}

export interface InterviewNoteCreateRequest {
  applicationId?: string;
  scheduleId?: string;
  companyName: string;
  roleTitle: string;
  interviewType: string;
  interviewDate: string;
  roundNumber?: number;
  questionsAsked: InterviewQA[];
  selfRating: number;
  strengths?: string[];
  weaknesses?: string[];
  followUpItems?: string[];
  generalNotes?: string;
}

export interface InterviewNoteUpdateRequest {
  questionsAsked?: InterviewQA[];
  selfRating?: number;
  strengths?: string[];
  weaknesses?: string[];
  followUpItems?: string[];
  generalNotes?: string;
}

export interface FeedbackCreateRequest {
  interviewerName: string;
  interviewerRole?: string;
  rating: number;
  feedbackText: string;
  recommendation: "strong_hire" | "hire" | "neutral" | "no_hire" | "strong_no_hire";
  strengths?: string[];
  concerns?: string[];
  sharedAt?: string;
}

export interface FeedbackUpdateRequest {
  round?: number;
  interviewer?: string;
  interviewerRole?: string;
  rating?: number;
  strengths?: string[];
  concerns?: string[];
  hireRecommendation?: "strong_hire" | "hire" | "no_hire" | "strong_no_hire";
  notes?: string;
}

export interface FollowUpEmailCreateRequest {
  applicationId?: string;
  interviewNoteId?: string;
  type: string;
  subject: string;
  body: string;
}

export interface FollowUpEmailUpdateRequest {
  subject?: string;
  body?: string;
  sentAt?: string;
}

export interface FollowUpEmailGenerateRequest {
  type: "thank_you" | "check_in" | "additional_materials" | "custom";
  roleTitle: string;
  companyName: string;
  interviewerName?: string;
  additionalContext?: string;
}

export interface PanelInterviewCreateRequest {
  applicationId?: string;
  companyName?: string;
  roleTitle?: string;
  scheduledAt: string;
  duration: number;
  location?: string;
  meetingLink?: string;
  interviewers: PanelInterviewer[];
  notes?: string;
}

export interface PanelInterviewUpdateRequest {
  scheduledAt?: string;
  duration?: number;
  interviewers?: PanelInterviewer[];
  status?: string;
  consolidatedFeedback?: string;
  notes?: string;
}

export interface CaseStudyCreateRequest {
  applicationId?: string;
  title: string;
  companyName?: string;
  roleTitle?: string;
  description: string;
  requirements?: string[];
  solution?: string;
  presentationUrl?: string;
  notes?: string;
}

export interface CaseStudyUpdateRequest {
  title?: string;
  description?: string;
  requirements?: string[];
  solution?: string;
  presentationUrl?: string;
  notes?: string;
}

export interface CaseStudyGenerateRequest {
  applicationId?: string;
  title?: string;
  focusArea?: string;
}

export interface InterviewAnalyticsRequest {
  startDate?: string;
  endDate?: string;
}

export interface OfferComparisonCreateRequest {
  applicationId?: string;
  companyName: string;
  roleTitle: string;
  baseSalary: number;
  currency: string;
  bonus?: number;
  equity?: OfferEquity;
  benefits: OfferBenefits;
  location: string;
  remotePolicy: string;
  startDate?: string;
  expiresAt?: string;
  notes?: string;
}

export interface OfferComparisonUpdateRequest {
  baseSalary?: number;
  bonus?: number;
  equity?: OfferEquity;
  benefits?: OfferBenefits;
  location?: string;
  remotePolicy?: string;
  startDate?: string;
  expiresAt?: string;
  status?: "pending" | "accepted" | "rejected" | "negotiating";
  notes?: string;
}

export interface NegotiationCoachCreateRequest {
  applicationId?: string;
  companyName?: string;
  roleTitle?: string;
  jobDescription?: string;
  resumeText?: string;
  offerDetails?: {
    baseSalary?: number;
    equity?: number;
    equityType?: string;
    bonus?: number;
    signOn?: number;
    benefits?: string[];
  };
}

export interface EquityCalculationRequest {
  grantType?: "RSU" | "ISO" | "NSO" | "options" | "shares";
  roleTitle?: string;
  amount?: number;
  vestingSchedule?: VestingSchedule;
  currentPrice?: number;
  strikePrice?: number;
  exitScenarios?: Array<{ name: string; value: number }>;
  equityDetails?: {
    totalShares?: number;
    sharePrice?: number;
    vestingSchedule?: string;
    vestingCliff?: number;
    equityType?: string;
    strikePrice?: number;
    refreshGrant?: number;
    currentSalary?: number;
  };
}

export interface BenefitsAnalysisRequest {
  offerId?: string;
  roleTitle?: string;
  companyName?: string;
  salary?: string;
  benefits?: Array<{ name: string; value: string; category: string }>;
}

export interface DecisionCreateRequest {
  offerIds: string[];
  criteria: DecisionCriterion[];
}

export interface DecisionUpdateRequest {
  criteria?: DecisionCriterion[];
  recommendation?: string;
  notes?: string;
}

export interface ResignationLetterGenerateRequest {
  currentCompany: string;
  roleTitle?: string;
  lastDay?: string;
  reason?: string;
  tone?: string;
  noticePeriod?: string;
  transitionPlan?: string;
  includePersonalNote?: boolean;
  personalNote?: string;
}

export interface OnboardingPlanCreateRequest {
  companyName: string;
  roleTitle: string;
  startDate: string;
  milestones: Omit<OnboardingMilestone, "id">[];
  learningGoals: Omit<LearningGoal, "id">[];
  stakeholders: Omit<Stakeholder, "id">[];
}

export interface OnboardingChecklistCreateRequest {
  companyName: string;
  roleTitle: string;
  startDate: string;
  categories: Omit<ChecklistCategory, "id">[];
}

export interface ChecklistItemUpdateRequest {
  completed?: boolean;
  completedAt?: string;
}

export interface ManagerAlignmentCreateRequest {
  companyName: string;
  roleTitle: string;
  managerName?: string;
  managerTitle?: string;
  jobDescription?: string;
  successMetrics?: Omit<SuccessMetric, "id">[];
  communicationPreferences?: CommunicationPreferences;
  meetingCadence?: MeetingCadence;
}

export interface NetworkMapCreateRequest {
  companyName: string;
  roleTitle?: string;
  jobDescription?: string;
  contacts?: Omit<NetworkContact, "id">[];
  coffeeChats?: Omit<CoffeeChat, "id">[];
}

export interface SkillRefreshCreateRequest {
  companyName: string;
  roleTitle: string;
  techStack?: string[];
  jobDescription?: string;
  learningPath?: Omit<LearningPathItem, "id">[];
}

export interface TrackerCreateRequest {
  applicationId?: string;
  companyName: string;
  roleTitle: string;
  startDate?: string;
  milestones?: First90Phase[];
  feedbackLoops?: First90FeedbackLoop[];
  earlyWins?: First90EarlyWin[];
}

export interface TrackerUpdateRequest {
  milestones?: First90Phase[];
  feedbackLoops?: First90FeedbackLoop[];
  earlyWins?: First90EarlyWin[];
}

export interface ProfileUpdateRequest {
  education?: ProfileEducation[];
  experience?: ProfileExperience[];
  projects?: ProfileProject[];
  skills?: string[];
  certifications?: ProfileCertification[];
  languages?: string[];
  headline?: string;
  summary?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  phone?: string;
}

export interface UserUpdateRequest {
  name?: string;
  email?: string;
  image?: string;
  headline?: string;
  summary?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  phone?: string;
}

export interface OnboardingCompleteRequest {
  step: number;
}

export interface CaseStudyListItem {
  id: string;
  applicationId: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface CaseStudyDetail extends CaseStudyListItem {
  requirements: string[];
  solution: string;
  presentationUrl?: string;
  notes?: string;
  updatedAt: string;
}

// ============================================================================
// Application Deadline Types
// ============================================================================

export interface ApplicationDeadline {
  id: string;
  userId: string;
  jobId?: string | null;
  job?: { id: string; companyName: string; title: string } | null;
  jobTitle?: string;
  companyName: string;
  roleTitle: string;
  deadline: string;
  reminderAt?: string | null;
  reminderSent: boolean;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Type Guards & Utilities
// ============================================================================

export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

export function isErrorResponse(response: ApiResponse<unknown>): response is ErrorResponse {
  return response.success === false;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// JSON Serialization Helpers (for Prisma JSON fields)
// ============================================================================

export function jsonToType<T>(json: unknown): T {
  return json as T;
}

export function typeToJson<T>(obj: T): unknown {
  return obj;
}