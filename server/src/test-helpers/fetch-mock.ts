import { vi } from 'vitest';

/**
 * Test helper for stubbing the global fetch boundary.
 *
 * The server reaches every external service (OpenAI-compatible AI endpoint,
 * JSearch on RapidAPI) through global fetch, so stubbing fetch keeps tests
 * fully offline and covers both metered APIs with one seam.
 */
export type FetchHandler = (
  url: string,
  init: RequestInit | undefined,
) => Response | Promise<Response>;

/**
 * Replace global fetch with a handler. Restores the original when the test
 * finishes (vitest restoreMocks covers vi.fn, so we pair it with onTestFinished).
 * Returns the vi.fn that now backs global fetch for per-call assertions.
 */
export function stubFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(async (url: any, init?: any) => handler(String(url), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Minimal OpenAI chat completion payload for AiService.chat. */
export function chatResponse(content: string, model = 'test-model') {
  return Response.json({
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content, refusal: null },
        finish_reason: 'stop',
      },
    ],
    usage: { total_tokens: 42 },
  });
}

/** Minimal OpenAI embeddings payload for AiService.getEmbedding. */
export function embeddingResponse(values: number[]) {
  return Response.json({ data: [{ embedding: values }] });
}

/** An upstream HTTP failure, e.g. 429 rate limit or 500 from the provider. */
export function errorResponse(status: number, body = 'upstream exploded') {
  return new Response(body, { status });
}

export function makeConfigService(values: Record<string, string>) {
  return { get: (key: string) => values[key] };
}
