import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RecalculateBody {
  equipment_id?: string;
  observation_days?: number;
}

export async function POST(request: Request) {
  let body: RecalculateBody;
  try {
    body = (await request.json()) as RecalculateBody;
  } catch {
    return NextResponse.json({ status: 'error', error: 'Invalid JSON body.' }, { status: 400 });
  }

  const equipmentId = body.equipment_id?.trim();
  if (!equipmentId) {
    return NextResponse.json(
      { status: 'error', error: 'equipment_id is required.' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { status: 'error', error: 'Not authenticated.' },
      { status: 401 },
    );
  }

  const functionsBase = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL?.replace(/\/$/, '');
  if (!functionsBase) {
    return NextResponse.json(
      { status: 'error', error: 'NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL is not configured.' },
      { status: 500 },
    );
  }

  const upstream = await fetch(`${functionsBase}/calculate-equipment-scores`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({
      equipment_id: equipmentId,
      observation_days: body.observation_days,
    }),
  });

  const payload = await upstream.json().catch(() => ({
    status: 'error',
    error: 'Edge function returned non-JSON response.',
  }));

  return NextResponse.json(payload, { status: upstream.status });
}
