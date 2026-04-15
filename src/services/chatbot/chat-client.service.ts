'use client';

import { createClient } from '@/lib/supabase/client';
import type { ChatContextRefs, ChatResponse } from '@/types/chatbot';

export interface ChatSessionListItem {
  id: string;
  title: string;
  created_at: string;
}

export interface PersistedChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  decision: string | null;
  answer_basis: string | null;
  confidence: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface SelectorOption {
  value: string;
  label: string;
}

export async function listChatSessions(limit = 20) {
  const supabase = createClient();
  return supabase
    .from('chat_sessions')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
}

export async function listChatMessages(sessionId: string) {
  const supabase = createClient();
  return supabase
    .from('chat_messages')
    .select('id, role, content, decision, answer_basis, confidence, created_at, metadata')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
}

export async function sendChatMessage(payload: {
  message: string;
  sessionId?: string;
  contextRefs?: ChatContextRefs;
}) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as ChatResponse | { error: string };
  if (!response.ok) {
    const errorMessage = 'error' in json ? json.error : 'Chat request failed';
    throw new Error(errorMessage);
  }

  return json as ChatResponse;
}

export async function getEquipmentSelectorOptions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('equipment_assets')
    .select('id, asset_code, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(100);
  if (error) return { data: [] as SelectorOption[], error };

  return {
    data: (data ?? []).map((item) => ({
      value: item.id as string,
      label: `${item.asset_code as string} - ${item.name as string}`,
    })),
    error: null,
  };
}

export async function getWorkOrderSelectorOptions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, work_order_number')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { data: [] as SelectorOption[], error };
  return {
    data: (data ?? []).map((item) => ({
      value: item.id as string,
      label: item.work_order_number as string,
    })),
    error: null,
  };
}

export async function getDepartmentSelectorOptions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code')
    .order('name', { ascending: true });
  if (error) return { data: [] as SelectorOption[], error };
  return {
    data: (data ?? []).map((item) => ({
      value: item.id as string,
      label: `${item.name as string} (${item.code as string})`,
    })),
    error: null,
  };
}
