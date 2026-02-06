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
      return `Suggest a creative, catchy, and unique RPG campaign title for a game using the '${payload.system}' system. Language: Portuguese. Return ONLY the title, no quotes.`;
    case 'suggestGenre':
      return payload.title && payload.title.length > 3
        ? `Based on the RPG campaign title "${payload.title}", suggest 1 to 3 suitable sub-genres/themes separated by commas. Language: Portuguese. Return ONLY the genres.`
        : `Suggest a creative RPG sub-genre based on 'Dark Fantasy' but make it unique (max 4 words). Return ONLY the genre name.`;
    case 'suggestWorldHistory':
      return `Create a short, engaging World History premise (max 3 sentences) specifically for a campaign using the '${payload.system}' system in the '${payload.genre}' genre. Ensure the tone matches the system mechanics. Language: Portuguese.`;
    case 'suggestStyle':
      return `Based on the World History and Genre below, suggest a concise 'visual_style' for an AI image generator (Stable Diffusion/Flux style). Genre: ${payload.genre}. System: ${payload.system}. World History: "${payload.worldHistory}". Response ONLY with the prompt string (e.g., "Dark Fantasy, Oil Painting, Gritty, High Contrast").`;
    case 'suggestCharacterName':
      return `Suggest a cool, unique character name fitting for a ${payload.genre} RPG setting using the ${payload.system} system. Return ONLY the name.`;
    case 'suggestCharacterAppearance':
      return `Describe the physical appearance of a RPG character named "${payload.name}" in a ${payload.genre} setting. concise, visual, max 2 sentences. Language: Portuguese.`;
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
