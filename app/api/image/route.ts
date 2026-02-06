import { NextResponse } from 'next/server';
import { isRateLimited } from '../../../lib/ai/rateLimit';

const POLLINATIONS_KEY = process.env.POLLINATIONS_KEY || '';

type ModelName = 'klein-large' | 'klein' | 'turbo' | 'flux' | 'zimage';

function getModelChain(userCount: number): ModelName[] {
  if (userCount < 5) return ['klein-large'];
  if (userCount <= 10) return ['klein', 'klein-large'];
  if (userCount <= 500) return ['turbo', 'klein', 'klein-large'];
  if (userCount <= 1000) return ['flux', 'zimage', 'turbo', 'klein', 'klein-large'];
  return ['flux', 'zimage', 'turbo', 'klein', 'klein-large'];
}

function buildUrl(prompt: string, model: string, width?: number, height?: number, seed?: number) {
  const base = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`;
  const params = new URLSearchParams();
  params.set('model', model);
  if (POLLINATIONS_KEY) params.set('key', POLLINATIONS_KEY);
  if (width) params.set('width', String(width));
  if (height) params.set('height', String(height));
  if (seed !== undefined) params.set('seed', String(seed));
  return `${base}?${params.toString()}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const rateKey = `image:${ip}`;
  if (await isRateLimited(rateKey)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  const prompt = searchParams.get('prompt') || '';
  if (!prompt.trim()) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const users = Number(searchParams.get('users') || '0');
  const width = Number(searchParams.get('width') || '0') || undefined;
  const height = Number(searchParams.get('height') || '0') || undefined;
  const seedParam = searchParams.get('seed');
  const seed = seedParam !== null ? Number(seedParam) : undefined;

  const models = getModelChain(Number.isFinite(users) ? users : 0);

  let lastError: any = null;
  for (const model of models) {
    const url = buildUrl(prompt, model, width, height, seed);
    const res = await fetch(url);

    if (res.ok) {
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await res.arrayBuffer();
      return new NextResponse(Buffer.from(arrayBuffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    lastError = res;
  }

  const status = lastError?.status || 502;
  return NextResponse.json({ error: 'Image generation failed' }, { status });
}
