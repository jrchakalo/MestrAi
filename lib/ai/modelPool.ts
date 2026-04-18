export const MASTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openrouter/free',
] as const;

export const FAST_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free',
  'openrouter/free',
] as const;

export const MODELS = MASTER_MODELS;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const modelIndexByKey = new Map<string, number>();

function clampIndex(index: number, maxLength: number) {
  if (index < 0) return 0;
  if (index >= maxLength) return maxLength - 1;
  return index;
}

function buildStateKey(key: string, models: readonly string[]) {
  return `${key}::${models.join('|')}`;
}

function isRetryableModelError(error: unknown) {
  const status = (error as any)?.status || (error as any)?.response?.status || (error as any)?.code;
  return [429, 503, 502, 404].includes(Number(status));
}

export async function withModelFallback<T>(
  handler: (model: string) => Promise<T>,
  options?: { minDelayMs?: number; key?: string; models?: readonly string[] }
): Promise<T> {
  let lastError: unknown;
  const models = options?.models?.length ? options.models : MODELS;
  const wait = Math.max(0, options?.minDelayMs ?? 500);
  const stateKey = options?.key ? buildStateKey(options.key, models) : '';
  const startIndex = stateKey ? clampIndex(modelIndexByKey.get(stateKey) ?? 0, models.length) : 0;

  for (let i = startIndex; i < models.length; i += 1) {
    const model = models[i];
    try {
      if (wait > 0 && i > startIndex) {
        await delay(wait);
      }
      const result = await handler(model);
      if (stateKey) {
        modelIndexByKey.set(stateKey, i);
      }
      return result;
    } catch (error) {
      lastError = error;
      if (i < models.length - 1 && isRetryableModelError(error)) {
        continue;
      }
    }
  }

  if (stateKey) {
    modelIndexByKey.set(stateKey, 0);
  }

  throw lastError ?? new Error('All models failed');
}
