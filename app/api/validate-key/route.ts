import { NextResponse } from 'next/server';
import { pickApiKey } from '../../../lib/ai/keyPool';
import { isRateLimited } from '../../../lib/ai/rateLimit';
import { MODELS } from '../../../lib/ai/modelPool';
import { createOpenRouterClient } from '../../../lib/ai/openRouter';

export async function POST(req: Request) {
  try {
    const userKey = req.headers.get('x-custom-api-key') || undefined;
    if (!userKey) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const rateKey = `validate:${ip}`;
      if (await isRateLimited(rateKey)) {
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
    }
    const apiKey = pickApiKey(userKey);
    const ai = createOpenRouterClient(apiKey);

    let sawRateLimit = false;
    let lastError: any;

    for (const model of MODELS) {
      try {
        await ai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          temperature: 0,
        });

        return NextResponse.json({ ok: true });
      } catch (err: any) {
        const status = err?.status || err?.response?.status || err?.code;

        if (status === 401 || status === 403) {
          return NextResponse.json(
            { ok: false, error: 'Chave inválida ou sem permissão no OpenRouter.' },
            { status: 401 }
          );
        }

        if (status === 429) {
          sawRateLimit = true;
          lastError = err;
          continue;
        }

        // Model temporarily unavailable on provider side; try next model.
        if (status === 404) {
          lastError = err;
          continue;
        }

        lastError = err;
      }
    }

    if (sawRateLimit) {
      return NextResponse.json(
        { ok: false, error: 'Essa chave está sem recursos. Tente outra.' },
        { status: 429 }
      );
    }

    const lastStatus = lastError?.status || lastError?.response?.status || lastError?.code;
    if (lastStatus && Number(lastStatus) >= 500) {
      return NextResponse.json(
        { ok: false, error: 'OpenRouter indisponível no momento. Tente novamente.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Falha ao validar a chave.' },
      { status: 400 }
    );
  } catch (error: any) {
    const message = error?.message || 'Validation failed';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
