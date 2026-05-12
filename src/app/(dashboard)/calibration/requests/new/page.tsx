import { redirect } from 'next/navigation';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewCalibrationRequestRedirect({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = new URLSearchParams({ action: 'new-request' });
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') next.set(key, value);
  }
  redirect(`/calibration?${next.toString()}`);
}
