import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { InterviewProcessService } from './interview-process.service';
import {
  CreateCaseStudyDto,
  CreateFeedbackDto,
  CreateFollowUpEmailDto,
  CreateInterviewNoteDto,
  CreatePanelInterviewDto,
  GenerateCaseStudyDto,
  GenerateFollowUpEmailDto,
  UpdateCaseStudyDto,
  UpdateFeedbackDto,
  UpdateFollowUpEmailDto,
  UpdateInterviewNoteDto,
  UpdatePanelInterviewDto,
} from './interview-process.dto';
import { BetterAuthRequest } from '../common/types';

@Controller('interview-process')
@UseGuards(SessionGuard)
export class InterviewProcessController {
  constructor(private processService: InterviewProcessService) {}

  // ─── Interview Notes ───

  @Post('notes')
  async createNote(@Request() req: BetterAuthRequest, @Body() body: CreateInterviewNoteDto) {
    return this.processService.createNote(req.user?.userId ?? '', body);
  }

  @Get('notes')
  async listNotes(
    @Request() req: BetterAuthRequest,
    @Query('companyName') companyName?: string,
    @Query('interviewType') interviewType?: string,
  ) {
    return this.processService.listNotes(req.user?.userId ?? '', { companyName, interviewType });
  }

  @Get('notes/:id')
  async getNote(@Request() req: BetterAuthRequest, @Param('id') id: string) {
    return this.processService.getNote(req.user?.userId ?? '', id);
  }

  @Patch('notes/:id')
  async updateNote(@Request() req: BetterAuthRequest, @Param('id') id: string, @Body() body: UpdateInterviewNoteDto) {
    return this.processService.updateNote(req.user?.userId ?? '', id, body);
  }

  @Delete('notes/:id')
  async deleteNote(@Request() req: BetterAuthRequest, @Param('id') id: string) {
    await this.processService.deleteNote(req.user?.userId ?? '', id);
    return { success: true };
  }

  // ─── Interviewer Feedback ───

  @Post('notes/:noteId/feedback')
  async addFeedback(@Request() req: BetterAuthRequest, @Param('noteId') noteId: string, @Body() body: CreateFeedbackDto) {
    return this.processService.addFeedback(req.user?.userId ?? '', noteId, body);
  }

  @Get('notes/:noteId/feedback')
  async listFeedbacks(@Request() req: BetterAuthRequest, @Param('noteId') noteId: string) {
    return this.processService.listFeedbacks(req.user?.userId ?? '', noteId);
  }

  @Patch('feedback/:id')
  async updateFeedback(@Request() req: BetterAuthRequest, @Param('id') id: string, @Body() body: UpdateFeedbackDto) {
    return this.processService.updateFeedback(req.user?.userId ?? '', id, body);
  }

  @Delete('feedback/:id')
  async deleteFeedback(@Request() req: BetterAuthRequest, @Param('id') id: string) {
    await this.processService.deleteFeedback(req.user?.userId ?? '', id);
    return { success: true };
  }

  // ─── Follow-up Emails ───

  @Post('follow-up-emails')
  async createFollowUpEmail(@Request() req: BetterAuthRequest, @Body() body: CreateFollowUpEmailDto) {
    return this.processService.createFollowUpEmail(req.user?.userId ?? '', body);
  }

  @Get('follow-up-emails')
  async listFollowUpEmails(
    @Request() req: BetterAuthRequest,
    @Query('type') type?: string,
    @Query('interviewNoteId') interviewNoteId?: string,
  ) {
    return this.processService.listFollowUpEmails(req.user?.userId ?? '', { type, interviewNoteId });
  }

  @Get('follow-up-emails/:id')
  async getFollowUpEmail(@Request() req: BetterAuthRequest, @Param('id') id: string) {
    return this.processService.getFollowUpEmail(req.user?.userId ?? '', id);
  }

  @Patch('follow-up-emails/:id')
  async updateFollowUpEmail(@Request() req: BetterAuthRequest, @Param('id') id: string, @Body() body: UpdateFollowUpEmailDto) {
    return this.processService.updateFollowUpEmail(req.user?.userId ?? '', id, body);
  }

  @Delete('follow-up-emails/:id')
  async deleteFollowUpEmail(@Request() req: BetterAuthRequest, @Param('id') id: string) {
    await this.processService.deleteFollowUpEmail(req.user?.userId ?? '', id);
    return { success: true };
  }

  @Post('follow-up-emails/generate')
  async generateFollowUpEmail(@Request() req: BetterAuthRequest, @Body() body: GenerateFollowUpEmailDto) {
    return this.processService.generateFollowUpEmail(req.user?.userId ?? '', body);
  }

  // ─── Panel Interviews ───

  @Post('panel-interviews')
  async createPanelInterview(@Request() req: BetterAuthRequest, @Body() body: CreatePanelInterviewDto) {
    return this.processService.createPanelInterview(req.user?.userId ?? '', body);
  }

  @Get('panel-interviews')
  async listPanelInterviews(
    @Request() req: BetterAuthRequest,
    @Query('status') status?: string,
  ) {
    return this.processService.listPanelInterviews(req.user?.userId ?? '', { status });
  }

  @Get('panel-interviews/:id')
  async getPanelInterview(@Request() req: BetterAuthRequest, @Param('id') id: string) {
    return this.processService.getPanelInterview(req.user?.userId ?? '', id);
  }

  @Patch('panel-interviews/:id')
  async updatePanelInterview(@Request() req: BetterAuthRequest, @Param('id') id: string, @Body() body: UpdatePanelInterviewDto) {
    return this.processService.updatePanelInterview(req.user?.userId ?? '', id, body);
  }

  @Delete('panel-interviews/:id')
  async deletePanelInterview(@Request() req: BetterAuthRequest, @Param('id') id: string) {
    await this.processService.deletePanelInterview(req.user?.userId ?? '', id);
    return { success: true };
  }

  // ─── Case Studies ───

  @Post('case-studies')
  async createCaseStudy(@Request() req: BetterAuthRequest, @Body() body: CreateCaseStudyDto) {
    return this.processService.createCaseStudy(req.user?.userId ?? '', body);
  }

  @Get('case-studies')
  async listCaseStudies(@Request() req: BetterAuthRequest) {
    return this.processService.listCaseStudies(req.user?.userId ?? '');
  }

  @Get('case-studies/:id')
  async getCaseStudy(@Request() req: BetterAuthRequest, @Param('id') id: string) {
    return this.processService.getCaseStudy(req.user?.userId ?? '', id);
  }

  @Patch('case-studies/:id')
  async updateCaseStudy(@Request() req: BetterAuthRequest, @Param('id') id: string, @Body() body: UpdateCaseStudyDto) {
    return this.processService.updateCaseStudy(req.user?.userId ?? '', id, body);
  }

  @Delete('case-studies/:id')
  async deleteCaseStudy(@Request() req: BetterAuthRequest, @Param('id') id: string) {
    await this.processService.deleteCaseStudy(req.user?.userId ?? '', id);
    return { success: true };
  }

  @Post('case-studies/generate')
  async generateCaseStudy(@Request() req: BetterAuthRequest, @Body() body: GenerateCaseStudyDto) {
    return this.processService.generateCaseStudy(req.user?.userId ?? '', body);
  }

  // ─── Analytics ───

  @Get('analytics')
  async getPerformanceAnalytics(@Request() req: BetterAuthRequest) {
    return this.processService.getPerformanceAnalytics(req.user?.userId ?? '');
  }
}
