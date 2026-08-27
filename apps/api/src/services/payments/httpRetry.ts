import { ProviderError } from './types';

// Minimal outbound HTTP client for provider calls: per-attempt timeout via
// AbortController plus exponential backoff for 429 and transient 5xx. Node 22
// global fetch is used — no extra dependency.

export interface RequestOptions {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  /** Exact serialized body string. For signed POSTs this MUST be the same
   *  string that was signed — never re-serialize. */
  body?: string;
  timeoutMs: number;
  maxAttempts?: number;
  /** Injectable sleep for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

export interface RawResponse {
  status: number;
  ok: boolean;
  text: string;
  headers: Headers;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function requestWithRetry(options: RequestOptions): Promise<RawResponse> {
  const {
    method, url, headers, body, timeoutMs,
    maxAttempts = 3,
    sleep = defaultSleep,
    fetchImpl = fetch
  } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { method, headers, body, signal: controller.signal });
      const text = await res.text();
      if (res.ok) return { status: res.status, ok: true, text, headers: res.headers };

      if (RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 250 * 2 ** (attempt - 1);
        await sleep(backoff);
        continue;
      }
      // Non-retryable, or out of attempts.
      return { status: res.status, ok: false, text, headers: res.headers };
    } catch (error) {
      const aborted = (error as Error)?.name === 'AbortError';
      if (attempt < maxAttempts) {
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }
      throw new ProviderError(
        aborted ? 'Payment provider timed out' : 'Payment provider is unreachable',
        { status: 502, code: aborted ? 'provider_timeout' : 'provider_unreachable', retryable: true }
      );
    } finally {
      clearTimeout(timer);
    }
  }
  // Unreachable: the loop always returns or throws.
  throw new ProviderError('Payment provider request failed', { status: 502, code: 'provider_error', retryable: true });
}
