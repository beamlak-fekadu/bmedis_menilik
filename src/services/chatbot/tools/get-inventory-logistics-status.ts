import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserChatProfile } from '@/types/chatbot';
import { loadLogistics } from './task-data-loaders';

export async function getInventoryLogisticsStatus(supabase: SupabaseClient, profile?: UserChatProfile) {
  const logistics = await loadLogistics(supabase, profile);
  return {
    lowStockParts: logistics.lowStockParts,
    topProcurement: logistics.procurementPipeline.slice(0, 6),
  };
}
