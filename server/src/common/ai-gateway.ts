import { HttpException, HttpStatus, Logger } from '@nestjs/common';

/**
 * Client-safe message for any AI-boundary failure. The upstream error text
 * (provider outages, raw response bodies) must never leak to API clients.
 */
export const AI_UNAVAILABLE_MESSAGE =
  'AI analysis is temporarily unavailable. Please try again later.';

/** 502 Bad Gateway for any failure inside an AI call path. */
export class AiUnavailableException extends HttpException {
  constructor() {
    super(AI_UNAVAILABLE_MESSAGE, HttpStatus.BAD_GATEWAY);
  }
}

/**
 * Wrap a hard-fail AI call path (chat → parse → persist). Unexpected errors
 * become AiUnavailableException (502) so clients get a stable message
 * instead of a raw 500 with upstream details. HttpExceptions thrown inside
 * the wrapped code (e.g. NotFoundException) pass through unchanged so their
 * status survives.
 *
 *   return withAiGateway('OfferNegotiationService.createCoach', async () => {
 *     const result = await this.aiService.chat(messages, options);
 *     return this.aiService.parseAIResponse(this.aiService.getResponseText(result));
 *   });
 */
export async function withAiGateway<T>(context: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    const message = error instanceof Error ? error.message : String(error);
    new Logger(context).error(`AI request failed: ${message}`);
    throw new AiUnavailableException();
  }
}
