import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * One entry of InterviewNote.questionsAsked — matches the JSON the client
 * sends ({ question, category, myAnswer, rating }) and the schema comment in
 * prisma/schema.prisma.
 */
export class InterviewQaDto {
  @IsString()
  @MinLength(1)
  question: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  myAnswer?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  rating?: number;
}

const INTERVIEW_TYPES = [
  'phone_screen',
  'technical',
  'behavioral',
  'panel',
  'onsite',
  'virtual',
  'other',
] as const;

export class CreateInterviewNoteDto {
  // The client can scope a note to an application; ownership is enforced by
  // the service (existing behavior — foreign ids surface as Prisma errors).
  @IsString()
  @IsOptional()
  applicationId?: string;

  @IsString()
  @IsOptional()
  scheduleId?: string;

  @IsString()
  @MinLength(1)
  companyName: string;

  @IsString()
  @MinLength(1)
  roleTitle: string;

  @IsString()
  @IsIn(INTERVIEW_TYPES)
  interviewType: string;

  @IsDateString()
  interviewDate: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  roundNumber?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewQaDto)
  questionsAsked: InterviewQaDto[];

  @IsInt()
  @Min(1)
  @Max(5)
  selfRating: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  strengths?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  weaknesses?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  followUpItems?: string[];

  @IsString()
  @IsOptional()
  generalNotes?: string;
}

export class UpdateInterviewNoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewQaDto)
  @IsOptional()
  questionsAsked?: InterviewQaDto[];

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  selfRating?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  strengths?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  weaknesses?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  followUpItems?: string[];

  @IsString()
  @IsOptional()
  generalNotes?: string;
}

// ─── Interviewer Feedback ───

const RECOMMENDATIONS = ['strong_hire', 'hire', 'neutral', 'no_hire', 'strong_no_hire'] as const;

export class CreateFeedbackDto {
  // The Prisma column is interviewerName — clients sending `interviewer`
  // (the old shape) now fail validation loudly instead of 500ing on create.
  @IsString()
  @MinLength(1)
  interviewerName: string;

  @IsString()
  @IsOptional()
  interviewerRole?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(1)
  feedbackText: string;

  @IsString()
  @IsIn(RECOMMENDATIONS)
  recommendation: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  strengths?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  concerns?: string[];

  @IsDateString()
  @IsOptional()
  sharedAt?: string;
}

export class UpdateFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  feedbackText?: string;

  @IsString()
  @IsIn(RECOMMENDATIONS)
  @IsOptional()
  recommendation?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  strengths?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  concerns?: string[];
}

// ─── Panel Interviews ───

const PANEL_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;

/** One entry of PanelInterview.interviewers JSON. */
export class PanelInterviewerDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class CreatePanelInterviewDto {
  @IsString()
  @IsOptional()
  applicationId?: string;

  @IsString()
  @MinLength(1)
  companyName: string;

  @IsString()
  @MinLength(1)
  roleTitle: string;

  @IsDateString()
  scheduledAt: string;

  @IsInt()
  @Min(1)
  duration: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  meetingLink?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PanelInterviewerDto)
  interviewers: PanelInterviewerDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePanelInterviewDto {
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  meetingLink?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PanelInterviewerDto)
  @IsOptional()
  interviewers?: PanelInterviewerDto[];

  @IsString()
  @IsIn(PANEL_STATUSES)
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

// ─── Case Studies ───

/** One entry of CaseStudy.slides JSON. */
export class CaseStudySlideDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  layout?: string;
}

export class CreateCaseStudyDto {
  @IsString()
  @IsOptional()
  applicationId?: string;

  @IsString()
  @MinLength(1)
  companyName: string;

  @IsString()
  @MinLength(1)
  roleTitle: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseStudySlideDto)
  @IsOptional()
  slides?: CaseStudySlideDto[];
}

export class UpdateCaseStudyDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseStudySlideDto)
  @IsOptional()
  slides?: CaseStudySlideDto[];
}

export class GenerateCaseStudyDto {
  @IsString()
  @MinLength(1)
  companyName: string;

  @IsString()
  @MinLength(1)
  roleTitle: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  description: string;

  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  slideCount?: number;
}

// ─── Follow-up Emails ───

const FOLLOW_UP_TYPES = ['thank_you', 'check_in', 'additional_materials', 'custom'] as const;

export class CreateFollowUpEmailDto {
  @IsString()
  @IsOptional()
  applicationId?: string;

  @IsString()
  @IsOptional()
  interviewNoteId?: string;

  @IsString()
  @IsIn(FOLLOW_UP_TYPES)
  type: string;

  @IsString()
  @MinLength(1)
  subject: string;

  @IsString()
  @MinLength(1)
  body: string;
}

export class UpdateFollowUpEmailDto {
  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsDateString()
  @IsOptional()
  sentAt?: string;
}

export class GenerateFollowUpEmailDto {
  @IsString()
  @IsIn(FOLLOW_UP_TYPES)
  type: string;

  @IsString()
  @MinLength(1)
  roleTitle: string;

  @IsString()
  @MinLength(1)
  companyName: string;

  @IsString()
  @IsOptional()
  interviewerName?: string;

  @IsString()
  @IsOptional()
  additionalContext?: string;
}
