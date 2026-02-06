export const MODELS = [
  // TENTATIVA 1: O Melhor (Llama 3.3 70B)
  'llama-3.3-70b-versatile',

  // TENTATIVA 2: O Lógico (Qwen 2.5 72B) - Caso o Llama esteja com fila
  'qwen-2.5-72b-instruct',

  // TENTATIVA 3: O "Tanque de Guerra" (Llama 3.1 8B) - Caso você estoure o limite diário
  'llama-3.1-8b-instant',
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const modelIndexByKey = new Map<string, number>();

function clampIndex(index: number) {
  if (index < 0) return 0;
  if (index >= MODELS.length) return MODELS.length - 1;
  return index;
}

export async function withModelFallback<T>(
  handler: (model: string) => Promise<T>,
  options?: { minDelayMs?: number; key?: string }
): Promise<T> {
  let lastError: unknown;
  const wait = Math.max(0, options?.minDelayMs ?? 0);
  const startIndex = options?.key
    ? clampIndex(modelIndexByKey.get(options.key) ?? 0)
    : 0;

  for (let i = startIndex; i < MODELS.length; i += 1) {
    const model = MODELS[i];
    try {
      if (wait > 0 && i > startIndex) {
        await delay(wait * (i - startIndex));
      }
      const result = await handler(model);
      if (options?.key) {
        modelIndexByKey.set(options.key, i);
      }
      return result;
    } catch (error) {
      const status = (error as any)?.status || (error as any)?.code;
      if (status === 429) {
        throw error;
      }
      lastError = error;
    }
  }

  if (options?.key) {
    modelIndexByKey.set(options.key, 0);
  }

  throw lastError ?? new Error('All models failed');
}
