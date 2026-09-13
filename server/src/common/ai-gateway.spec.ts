import { describe, expect, it, vi } from 'vitest';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import {
  withAiGateway,
  AiUnavailableException,
  AI_UNAVAILABLE_MESSAGE,
} from './ai-gateway';

describe('withAiGateway', () => {
  it('returns the wrapped value on success', async () => {
    const result = await withAiGateway('test', async () => 42);
    expect(result).toBe(42);
  });

  it('maps unexpected errors to a 502 AiUnavailableException', async () => {
    const promise = withAiGateway('test', async () => {
      throw new Error('OpenAI API error (503): upstream exploded');
    });

    await expect(promise).rejects.toBeInstanceOf(AiUnavailableException);
    await expect(promise).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });
  });

  it('never leaks the upstream error text to the client', async () => {
    const err = await withAiGateway('test', async () => {
      throw new Error('secret upstream payload: sk-abc123 quota exceeded');
    }).then(
      () => null,
      (e) => e,
    );

    expect(err).toBeInstanceOf(HttpException);
    expect(err.getResponse()).toBe(AI_UNAVAILABLE_MESSAGE);
    expect(err.getResponse()).not.toContain('sk-abc123');
  });

  it('passes HttpExceptions through unchanged (404 keeps its status)', async () => {
    const promise = withAiGateway('test', async () => {
      throw new NotFoundException('Company briefing not found');
    });

    await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    await expect(promise).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
  });

  it('passes other HttpExceptions (e.g. 400) through with their status', async () => {
    const original = new HttpException('bad input', HttpStatus.BAD_REQUEST);

    await expect(
      withAiGateway('test', async () => {
        throw original;
      }),
    ).rejects.toBe(original);
  });

  it('handles non-Error throwables', async () => {
    await expect(
      withAiGateway('test', async () => {
        throw 'a string was thrown';
      }),
    ).rejects.toBeInstanceOf(AiUnavailableException);
  });

  it('works with async values that resolve after a tick', async () => {
    const result = await withAiGateway('test', async () => {
      await new Promise((r) => setTimeout(r, 1));
      return { ok: true };
    });
    expect(result).toEqual({ ok: true });
  });

  it('exposes a stable AI_UNAVAILABLE_MESSAGE contract', () => {
    expect(AI_UNAVAILABLE_MESSAGE).toBe(
      'AI analysis is temporarily unavailable. Please try again later.',
    );
    expect(new AiUnavailableException().getResponse()).toBe(AI_UNAVAILABLE_MESSAGE);
  });
});
