import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import {
  chatResponse,
  embeddingResponse,
  errorResponse,
  makeConfigService,
  stubFetch,
} from '../test-helpers/fetch-mock';

const service = () =>
  new AiService(
    makeConfigService({
      OPENAI_API_KEY: 'test-key',
      OPENAI_BASE_URL: 'https://llm.example/v1',
      OPENAI_MODEL: 'test-model',
    }) as unknown as ConfigService,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AiService.chat', () => {
  it('posts a string prompt to the configured base URL with bearer auth and defaults', async () => {
    const ai = service();
    const fetchMock = stubFetch(() => chatResponse('hello'));

    const response = await ai.chat('Summarize this resume');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://llm.example/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('test-model');
    expect(body.messages).toEqual([{ role: 'user', content: 'Summarize this resume' }]);
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(8192);

    expect(response.message.content).toBe('hello');
    expect(response.message.role).toBe('assistant');
    expect(response.finish_reason).toBe('stop');
    expect(response.usage).toEqual([{ type: 'completion', model: 'test-model', amount: 42, cost: 0 }]);
  });

  it('passes a message array through and applies options and response_format', async () => {
    const ai = service();
    const fetchMock = stubFetch(() => chatResponse('{}'));

    await ai.chat(
      [
        { role: 'system', content: 'You are an ATS scorer.' },
        { role: 'user', content: 'Score it' },
      ],
      { model: 'other-model', temperature: 0.1, max_tokens: 256, response_format: { type: 'json_object' } },
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('other-model');
    expect(body.temperature).toBe(0.1);
    expect(body.max_tokens).toBe(256);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toHaveLength(2);
  });

  it('falls back to provider defaults when env vars are unset', async () => {
    const ai = new AiService(makeConfigService({}) as unknown as ConfigService);
    const fetchMock = stubFetch(() => chatResponse('ok'));

    await ai.chat('ping');

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('returns empty content and no usage when the response has no choices or usage', async () => {
    const ai = service();
    stubFetch(() =>
      Response.json({ model: 'test-model', choices: [], }),
    );

    const response = await ai.chat('ping');

    expect(response.message.content).toBe('');
    expect(response.finish_reason).toBe('stop');
    expect(response.usage).toEqual([]);
  });

  it('passes a truncated finish_reason through and surfaces the refusal field', async () => {
    const ai = service();
    stubFetch(() =>
      Response.json({
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: null, refusal: 'I cannot help with that.' },
            finish_reason: 'length',
          },
        ],
      }),
    );

    const response = await ai.chat('ping');

    expect(response.finish_reason).toBe('length');
    expect(response.message.refusal).toBe('I cannot help with that.');
    expect(response.message.content).toBe('');
    expect(ai.getResponseText(response)).toBe('');
  });

  it('throws a typed upstream error when the provider returns 500', async () => {
    const ai = service();
    stubFetch(() => errorResponse(500, 'model overloaded'));

    await expect(ai.chat('ping')).rejects.toThrow(
      'OpenAI API error (500): model overloaded',
    );
  });

  it('survives an unreadable error body by reporting "Unknown error"', async () => {
    const ai = service();
    stubFetch(() =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('stream broken'));
          },
        }),
        { status: 429 },
      ),
    );

    await expect(ai.chat('ping')).rejects.toThrow('OpenAI API error (429): Unknown error');
  });
});

describe('AiService.parseAIResponse', () => {
  const ai = service();

  it('parses pure JSON', () => {
    expect(ai.parseAIResponse('{"score": 72}')).toEqual({ score: 72 });
  });

  it('parses a ```json fenced block', () => {
    const text = 'Here is your analysis:\n```json\n{"score": 72}\n```\nThanks!';
    expect(ai.parseAIResponse(text)).toEqual({ score: 72 });
  });

  it('parses a plain fenced block', () => {
    const text = '```\n{"score": 72}\n```';
    expect(ai.parseAIResponse(text)).toEqual({ score: 72 });
  });

  it('extracts the first JSON object embedded in prose', () => {
    const text = 'The result {"score": 72, "notes": "good"} is ready.';
    expect(ai.parseAIResponse(text)).toEqual({ score: 72, notes: 'good' });
  });

  it('throws with a 200-char preview when nothing parses', () => {
    const garbage = 'x'.repeat(500);
    try {
      ai.parseAIResponse(garbage);
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('Failed to parse AI response as JSON');
      expect(message).toContain('x'.repeat(200));
      expect(message.length).toBeLessThan(300);
    }
  });

  it('prefers the pure-JSON rung even when the content contains fence markers', () => {
    const text = '{"score": 72, "note": "wrap it in ```json fences``` if you like"}';
    expect(ai.parseAIResponse(text)).toEqual({
      score: 72,
      note: 'wrap it in ```json fences``` if you like',
    });
  });

  it('uses the first ```json fence when several are present', () => {
    const text = '```json\n{"a": 1}\n```\nmore prose\n```json\n{"b": 2}\n```';
    expect(ai.parseAIResponse(text)).toEqual({ a: 1 });
  });

  it('rescues fence content polluted by trailing prose via the brace rung', () => {
    const text = '```json\n{"a": 1} hope this helps\n```';
    expect(ai.parseAIResponse(text)).toEqual({ a: 1 });
  });

  it('falls back to the brace rung for an uppercase ```JSON fence hint', () => {
    const text = '```JSON\n{"a": 1}\n```';
    expect(ai.parseAIResponse(text)).toEqual({ a: 1 });
  });

  it('parses a top-level JSON array and whitespace-padded JSON', () => {
    expect(ai.parseAIResponse('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(ai.parseAIResponse('  \n\t{"a": 1}\n  ')).toEqual({ a: 1 });
  });

  it('parses a nested object embedded in prose via the greedy brace match', () => {
    expect(ai.parseAIResponse('Result: {"a": {"b": 1}} done')).toEqual({ a: { b: 1 } });
  });

  it('REGRESSION: throws when prose contains braces before the JSON (greedy first-brace limitation)', () => {
    // The brace rung matches from the FIRST '{' to the LAST '}', so prose
    // braces poison it and every earlier rung fails too. Known limitation —
    // pinned so a future fix is a deliberate behavior change.
    const text = 'Note: use {curly} braces. Result: {"score": 72}';
    expect(() => ai.parseAIResponse(text)).toThrow(/Failed to parse AI response as JSON/);
  });

  it('REGRESSION: throws on trailing-comma JSON (malformed)', () => {
    expect(() => ai.parseAIResponse('{"score": 72,}')).toThrow(
      /Failed to parse AI response as JSON/,
    );
  });

  it('REGRESSION: throws when a fence contains JSON truncated mid-object', () => {
    const text = '```json\n{"score": 72, "sections": {"structure": {"sc\n```';
    expect(() => ai.parseAIResponse(text)).toThrow(/Failed to parse AI response as JSON/);
  });

  it('REGRESSION: throws on empty content with an empty preview', () => {
    try {
      ai.parseAIResponse('');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).toBe('Failed to parse AI response as JSON. Preview: ');
    }
  });
});

describe('AiService.getResponseText', () => {
  it('returns string content as-is', () => {
    const ai = service();
    const response = {
      index: 0,
      message: { role: 'assistant', content: 'the text', refusal: null },
      finish_reason: 'stop',
      usage: [],
    };
    expect(ai.getResponseText(response)).toBe('the text');
  });

  it('returns an empty string for null content', () => {
    const ai = service();
    const response = {
      index: 0,
      message: { role: 'assistant', content: null, refusal: null },
      finish_reason: 'stop',
      usage: [],
    };
    expect(ai.getResponseText(response)).toBe('');
  });
});

describe('AiService downstream contract: chat → getResponseText → parseAIResponse', () => {
  it('throws a parse error when a length-truncated completion cuts the JSON mid-object', async () => {
    const ai = service();
    const truncated = '{"score": 72, "sections": {"structure": {"sc';
    stubFetch(() =>
      Response.json({
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: truncated, refusal: null },
            finish_reason: 'length',
          },
        ],
      }),
    );

    const response = await ai.chat('analyze this resume');
    expect(response.finish_reason).toBe('length');

    const text = ai.getResponseText(response);
    expect(() => ai.parseAIResponse(text)).toThrow('Failed to parse AI response as JSON');
    // The preview must include the truncation point so failures are diagnosable.
    expect(() => ai.parseAIResponse(text)).toThrow('{"score": 72');
  });

  it('throws a parse error (not undefined) when the model returns no choices', async () => {
    const ai = service();
    stubFetch(() => Response.json({ model: 'test-model', choices: [] }));

    const response = await ai.chat('analyze this resume');
    expect(ai.getResponseText(response)).toBe('');
    expect(() => ai.parseAIResponse(ai.getResponseText(response))).toThrow(
      'Failed to parse AI response as JSON',
    );
  });
});

describe('AiService.getEmbedding', () => {
  it('requests the embeddings endpoint with the fixed embedding model and returns the vector', async () => {
    const ai = service();
    const vector = [0.1, 0.2, 0.3];
    const fetchMock = stubFetch(() => embeddingResponse(vector));

    const result = await ai.getEmbedding('senior react developer');

    expect(fetchMock.mock.calls[0][0]).toBe('https://llm.example/v1/embeddings');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('text-embedding-3-small');
    expect(body.input).toBe('senior react developer');
    expect(result).toEqual(vector);
  });

  it('returns an empty array when the response has no data', async () => {
    const ai = service();
    stubFetch(() => Response.json({ data: [] }));

    expect(await ai.getEmbedding('text')).toEqual([]);
  });

  it('throws a typed upstream error when embeddings fail', async () => {
    const ai = service();
    stubFetch(() => errorResponse(503, 'embeddings unavailable'));

    await expect(ai.getEmbedding('text')).rejects.toThrow(
      'OpenAI embeddings API error (503): embeddings unavailable',
    );
  });
});

describe('AiService.cosineSimilarity', () => {
  const ai = service();

  it('returns 1 for identical vectors', () => {
    expect(AiService.cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(AiService.cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('returns 0 for mismatched lengths and empty vectors', () => {
    expect(AiService.cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(AiService.cosineSimilarity([], [])).toBe(0);
  });

  it('is order-independent: sim(a,b) equals sim(b,a)', () => {
    const a = [0.5, -1, 2];
    const b = [3, 0.25, -0.1];
    expect(AiService.cosineSimilarity(a, b)).toBeCloseTo(AiService.cosineSimilarity(b, a), 12);
  });
});

describe('AiService.validateFeedback', () => {
  it('passes valid scores and tips through unchanged', () => {
    const ai = service();
    const raw = {
      overallScore: 72,
      ATS: { score: 80, tips: [{ type: 'improve', tip: 'add keywords' }] },
      toneAndStyle: { score: 65, tips: [{ type: 'good', tip: 'clear voice' }] },
      content: { score: 70, tips: [{ type: 'improve', tip: 'quantify impact' }] },
      structure: { score: 75, tips: [{ type: 'good', tip: 'clean sections' }] },
      skills: { score: 60, tips: [{ type: 'improve', tip: 'list testing skills' }] },
    };

    const result = ai.validateFeedback(raw);

    expect(result.overallScore).toBe(72);
    expect(result.ATS).toEqual({ score: 80, tips: [{ type: 'improve', tip: 'add keywords' }] });
    expect(result.skills.tips).toEqual([{ type: 'improve', tip: 'list testing skills' }]);
  });

  it('substitutes zero scores and default tips for a null or malformed response', () => {
    const ai = service();

    for (const raw of [null, undefined, { overallScore: 'high' }]) {
      const result = ai.validateFeedback(raw);
      expect(result.overallScore).toBe(0);
      for (const section of ['ATS', 'toneAndStyle', 'content', 'structure', 'skills']) {
        expect(result[section].score).toBe(0);
        expect(Array.isArray(result[section].tips)).toBe(true);
        expect(result[section].tips.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps valid tips for some sections while defaulting the empty ones', () => {
    const ai = service();
    const result = ai.validateFeedback({
      ATS: { score: 50, tips: [] },
      content: { score: 90, tips: [{ type: 'good', tip: 'strong bullets' }] },
    });

    expect(result.ATS.score).toBe(50);
    expect(result.ATS.tips.length).toBe(3);
    expect(result.content.tips).toEqual([{ type: 'good', tip: 'strong bullets' }]);
  });
});
