'use server';

import { z } from 'zod';
import { actionError, getActionContextForCapability, logServerAuditEvent, type ActionResult } from './_shared';
import { sendMail } from '@/services/email.service';

const RECIPIENT = process.env.BMEDIS_TRAINING_REQUEST_TO?.trim() || 'beamlak.work@gmail.com';
const ALLOWED_REQUEST_ROLES = new Set(['developer', 'admin', 'bme_head']);

const bmedisTrainingRequestSchema = z.object({
  requester_name: z.string().trim().min(2, 'Requester name is required.'),
  requester_email: z.string().trim().email('A valid requester email is required.'),
  requester_phone: z.string().trim().optional().nullable(),
  organization: z.string().trim().min(2, 'Organization or facility is required.'),
  department_name: z.string().trim().optional().nullable(),
  role_title: z.string().trim().min(2, 'Role/title is required.'),
  training_mode: z.enum(['online', 'onsite', 'hybrid']),
  audience_size: z.coerce.number().int().min(1).max(10000),
  preferred_date: z.string().trim().optional().nullable(),
  alternate_date: z.string().trim().optional().nullable(),
  focus_areas: z.array(z.string().trim().min(1)).min(1, 'Select at least one focus area.'),
  goals: z.string().trim().min(20, 'Please describe the training goals in at least 20 characters.'),
});

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n');
}

function formatDateOrFallback(value: string | null | undefined) {
  if (!value) return 'Not specified';
  return value;
}

export async function requestBmedisSystemTrainingAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('training.schedule');
    if (error || !profile) return { success: false, error };
    if (!profile.roleNames.some((role) => ALLOWED_REQUEST_ROLES.has(role))) {
      return { success: false, error: 'Only BME Head-level users can request BMEDIS system training.' };
    }

    const parsed = bmedisTrainingRequestSchema.parse(payload);
    const submittedAt = new Date().toISOString();
    const request = {
      ...parsed,
      requester_phone: emptyToNull(parsed.requester_phone),
      department_name: emptyToNull(parsed.department_name),
      preferred_date: emptyToNull(parsed.preferred_date),
      alternate_date: emptyToNull(parsed.alternate_date),
      submitted_by_profile_id: profile.id,
      submitted_by_roles: profile.roleNames,
      submitted_at: submittedAt,
      recipient: RECIPIENT,
    };

    const subject = `BMEDIS system training request - ${request.organization}`;
    const text = [
      'A BME Head submitted a BMEDIS system training request.',
      '',
      `Requester: ${request.requester_name}`,
      `Email: ${request.requester_email}`,
      `Phone: ${request.requester_phone ?? 'Not provided'}`,
      `Role/title: ${request.role_title}`,
      `Organization/facility: ${request.organization}`,
      `Department: ${request.department_name ?? 'Not provided'}`,
      '',
      `Preferred mode: ${request.training_mode}`,
      `Audience size: ${request.audience_size}`,
      `Preferred date: ${formatDateOrFallback(request.preferred_date)}`,
      `Alternate date: ${formatDateOrFallback(request.alternate_date)}`,
      '',
      'Focus areas:',
      formatList(request.focus_areas),
      '',
      'Training goals / coordination notes:',
      request.goals,
      '',
      `Submitted at: ${submittedAt}`,
      `Profile ID: ${profile.id}`,
    ].join('\n');

    const htmlRows: Array<[string, string]> = [
      ['Requester', request.requester_name],
      ['Email', request.requester_email],
      ['Phone', request.requester_phone ?? 'Not provided'],
      ['Role/title', request.role_title],
      ['Organization/facility', request.organization],
      ['Department', request.department_name ?? 'Not provided'],
      ['Preferred mode', request.training_mode],
      ['Audience size', String(request.audience_size)],
      ['Preferred date', formatDateOrFallback(request.preferred_date)],
      ['Alternate date', formatDateOrFallback(request.alternate_date)],
      ['Submitted at', submittedAt],
      ['Profile ID', profile.id],
    ];

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2>BMEDIS system training request</h2>
        <p>A BME Head submitted a training coordination request from the BMEDIS Requests hub.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
          <tbody>
            ${htmlRows.map(([label, value]) => `
              <tr>
                <th style="border: 1px solid #d1d5db; background: #f9fafb; padding: 8px; text-align: left; width: 220px;">${escapeHtml(label)}</th>
                <td style="border: 1px solid #d1d5db; padding: 8px;">${escapeHtml(value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h3>Focus areas</h3>
        <ul>${request.focus_areas.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        <h3>Training goals / coordination notes</h3>
        <p>${escapeHtml(request.goals).replace(/\n/g, '<br />')}</p>
      </div>
    `;

    await sendMail({
      to: RECIPIENT,
      subject,
      text,
      html,
      replyTo: { name: request.requester_name, address: request.requester_email },
    });

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'bmedis_training_request.email_sent',
      entityType: 'bmedis_training_request',
      entityId: null,
      newValues: request,
    });

    return { success: true, data: { recipient: RECIPIENT, submitted_at: submittedAt } };
  } catch (err) {
    return actionError(err, 'Failed to send BMEDIS system training request');
  }
}
