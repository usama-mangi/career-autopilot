import { IsString, IsOptional, IsIn, IsDateString, IsNumber, Min, Max } from 'class-validator';

export class CreateApplicationBundleDto {
  @IsString()
  @IsOptional()
  jobId?: string;

  @IsString()
  @IsOptional()
  resumeId?: string;

  @IsString()
  @IsOptional()
  coverLetterId?: string;

  // The controller defaults these when absent; declared so the whitelist
  // keeps them instead of stripping them silently.
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  roleTitle?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateApplicationBundleDto {
  @IsString()
  @IsOptional()
  resumeId?: string;

  @IsString()
  @IsOptional()
  coverLetterId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsIn(['draft', 'applied', 'phone_screen', 'interviewing', 'offer', 'rejected', 'accepted', 'withdrawn'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  referralContact?: string;

  @IsString()
  @IsOptional()
  nextSteps?: string;
}

export class CreateCommunicationLogDto {
  // Injected from the route param (POST applications/:id/comms); optional so
  // the client never has to send it.
  @IsString()
  @IsOptional()
  applicationId?: string;

  @IsString()
  @IsIn(['email', 'phone', 'message', 'in_person', 'video_call', 'linkedin', 'other'])
  type: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  direction?: 'inbound' | 'outbound';

  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @IsString()
  @IsOptional()
  outcome?: string;
}

export class CreateReferralDto {
  // Injected from the route param (POST applications/:id/referral).
  @IsString()
  @IsOptional()
  applicationId?: string;

  @IsString()
  employeeName: string;

  @IsString()
  @IsOptional()
  employeeEmail?: string;

  @IsString()
  @IsOptional()
  relationship?: string;

  @IsString()
  @IsIn(['not_requested', 'requested', 'agreed', 'declined', 'submitted'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  requestedAt?: string;

  @IsDateString()
  @IsOptional()
  respondedAt?: string;
}

export class ApplicationAnalyticsQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;
}
