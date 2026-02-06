import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { pickApiKey } from '../../../lib/ai/keyPool';
import { isRateLimited } from '../../../lib/ai/rateLimit';
import { MODELS } from '../../../lib/ai/modelPool';

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
    const ai = new Groq({ apiKey });
    const model = MODELS[0];
    try {
      await ai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
      });
    } catch (err: any) {
      const status = err?.status || err?.response?.status || err?.code;
      if (status === 429) {
        return NextResponse.json(
          { ok: false, error: 'Essa chave está sem recursos. Tente outra.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { ok: false, error: 'Falha ao validar a chave.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const message = error?.message || 'Validation failed';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
