import { createClient } from '@/lib/supabase/server';

export interface CronJobLogRow {
  id: string;
  job_name: string;
  triggered_at: string;
  finished_at: string | null;
  status: 'triggered' | 'success' | 'error' | 'timeout';
  response_status: number | null;
  error_message: string | null;
  request_id: number | null;
}

export async function getCronJobHistory(limit = 10): Promise<CronJobLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cron_job_log')
    .select('id, job_name, triggered_at, finished_at, status, response_status, error_message, request_id')
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as CronJobLogRow[];
}

export async function getLastSnapshotRefresh(): Promise<CronJobLogRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cron_job_log')
    .select('id, job_name, triggered_at, finished_at, status, response_status, error_message, request_id')
    .eq('job_name', 'nightly-analytics-refresh')
    .eq('status', 'success')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as CronJobLogRow;
}
