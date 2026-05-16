import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserChatProfile } from '@/types/chatbot';
import { loadLogistics } from './task-data-loaders';

export async function getProcurementStatus(supabase: SupabaseClient, profile?: UserChatProfile) {
  const logistics = await loadLogistics(supabase, profile);
  return {
    procurementPipeline: logistics.procurementPipeline,
    lowStockCount: logistics.lowStockParts.length,
  };
}
