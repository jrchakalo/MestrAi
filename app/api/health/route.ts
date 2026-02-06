import { NextResponse } from 'next/server';
import { isRateLimited } from '../../../lib/ai/rateLimit';

export async function GET() {
  const rateKey = 'health';
  if (await isRateLimited(rateKey)) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
  }
  return NextResponse.json({ ok: true });
}
