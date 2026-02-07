import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { pickApiKey } from '../../../lib/ai/keyPool';
import { isRateLimited } from '../../../lib/ai/rateLimit';
import { withModelFallback } from '../../../lib/ai/modelPool';

const bodySchema = z.object({
  type: z.string(),
  payload: z.record(z.any()).optional(),
});

function buildPrompt(type: string, payload: Record<string, any> = {}) {
  switch (type) {
    case 'suggestTitle':
      return `Sugira um titulo criativo e memoravel para uma campanha de RPG com genero "${payload.genero}", tom "${payload.tom}", magia "${payload.magia}" e tecnologia "${payload.tech}". Idioma: Portugues. Retorne APENAS o titulo, sem aspas.`;
    case 'suggestWorldHistory':
      return `Crie uma historia de mundo curta e envolvente (max 3 frases) para uma campanha de genero "${payload.genero}", tom "${payload.tom}", magia "${payload.magia}" e tecnologia "${payload.tech}". Idioma: Portugues.`;
    case 'suggestStyle':
      return `Com base na historia do mundo e nos pilares abaixo, sugira um "visual_style" conciso para gerador de imagens (Stable Diffusion/Flux). Genero: ${payload.genero}. Tom: ${payload.tom}. Magia: ${payload.magia}. Tecnologia: ${payload.tech}. Historia: "${payload.worldHistory}". Responda APENAS com o prompt.`;
    case 'suggestCharacterName':
      return `Sugira um nome unico para um personagem em um mundo ${payload.genero} com tom ${payload.tom}. Retorne APENAS o nome.`;
    case 'suggestCharacterAppearance':
      return `Descreva a aparencia fisica de um personagem chamado "${payload.name}" em um cenario ${payload.genero}. Seja conciso, visual, max 2 frases. Idioma: Portugues.`;
    case 'suggestCharacterBackstory':
      {
        const appearance = (payload.appearance || '').toString().trim();
        const profession = (payload.profession || '').toString().trim();
        const appearanceHint = appearance ? `Appearance: ${appearance}. ` : '';
        const professionHint = profession ? `Profession/Occupation: ${profession}. ` : '';
        return `Write a short backstory (3 sentences) for a character named ${payload.name}. ${appearanceHint}${professionHint}World Context: ${payload.worldHistory}. Language: Portuguese.`;
      }
    case 'suggestCharacterProfession':
      {
        const appearance = (payload.appearance || '').toString().trim();
        const backstory = (payload.backstory || '').toString().trim();
        const hints = [
          appearance ? `Aparência: ${appearance}` : '',
          backstory ? `Background: ${backstory}` : '',
        ].filter(Boolean).join(' | ');
        const prefix = hints ? `${hints}. ` : '';
        return `Sugira uma profissão/ocupação curta (1 a 3 palavras) para o personagem. ${prefix}Retorne APENAS a profissão/ocupação.`;
      }
    default:
      return null;
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const prompt = buildPrompt(parsed.data.type, parsed.data.payload || {});
    if (!prompt) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const userKey = req.headers.get('x-custom-api-key') || undefined;

    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const rateKey = `suggest:${ip}`;
    if (await isRateLimited(rateKey)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    let apiKey: string;
    try {
      apiKey = pickApiKey(userKey);
    } catch {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }
    const ai = new Groq({ apiKey });
    const result = await withModelFallback(
      (model) =>
        ai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      { key: `suggest:${parsed.data.type}` }
    );

    const text = result.choices?.[0]?.message?.content || '';
    return NextResponse.json({ text });
  } catch (error) {
    console.error('Suggest API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
