import { NextResponse } from 'next/server';
import { getQrBaseUrl } from '@/utils/qr/url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    baseUrl: getQrBaseUrl(),
  });
}
