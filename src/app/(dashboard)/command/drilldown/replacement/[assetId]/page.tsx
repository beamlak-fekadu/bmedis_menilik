import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { ScoreExplanation } from '../../../_components/ScoreExplanation';
import { buildReplacementReason } from '@/utils/decision-support/command-center-reasons';
import { replacementReportPrefill } from '../../../_lib/command-center-routes';
import AssistantPageContextBridge from '@/components/assistant/AssistantPageContextBridge';

export default async function ReplacementEvidencePage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const profile = await requireRole(['developer', 'admin', 'bme_head', 'department_head', 'viewer']);
  const canMutate = Boolean(profile.roleNames?.some((role: string) => ['developer', 'admin', 'bme_head'].includes(role)));
  const supabase = await createClient();

  const { data } = await supabase
    .from('v_replacement_decision')
    .select('asset_id, asset_code, asset_name, department_name, age_score, failure_score, availability_score, maintenance_burden_score, spare_part_score, risk_score, cost_score, replacement_priority_index, replacement_rank, justification')
    .eq('asset_id', assetId)
    .maybeSingle();

  if (!data) {
    return <div className="space-y-4"><Link href="/command" className="inline-flex items-center gap-1 text-sm text-violet-300"><ArrowLeft className="h-4 w-4" /> Command Center</Link><p className="text-sm text-[var(--text-muted)]">Replacement evidence not found.</p></div>;
  }

  // R32: load the canonical replacement_priority_scores.id so the lifecycle
  // launchers can persist source_replacement_score_id on the resulting
  // disposal/procurement record. Filter to computed rows (NULL weights_profile_id)
  // — same filter analytics.service.ts:getReplacementPriorities uses.
  const scoreRow = await supabase
    .from('replacement_priority_scores')
    .select('id')
    .eq('asset_id', assetId)
    .is('weights_profile_id', null)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const replacementScoreId = (scoreRow.data as { id?: string } | null)?.id ?? null;

  const rpi = Number(data.replacement_priority_index ?? 0);
  const reason = buildReplacementReason({
    rank: Number(data.replacement_rank ?? 0),
    priorityIndex: rpi,
    ageScore: data.age_score as number | null,
    failureScore: data.failure_score as number | null,
    availabilityScore: data.availability_score as number | null,
    maintenanceBurdenScore: data.maintenance_burden_score as number | null,
    sparePartScore: data.spare_part_score as number | null,
    riskScore: data.risk_score as number | null,
    costScore: data.cost_score as number | null,
    justification: data.justification as string | null,
  });

  return (
    <div className="space-y-6">
      <AssistantPageContextBridge
        moduleLabel="Command Center"
        pageLabel={`Replacement Evidence — ${data.asset_name ?? 'Asset'}`}
        selectedRecordType="equipment_asset"
        selectedRecordId={assetId}
        selectedRecordLabel={`${data.asset_code ?? ''} ${data.asset_name ?? ''}`.trim()}
        contextRefs={{ equipmentId: assetId }}
        pageSummary="Replacement priority drilldown. RPI is a weighted, normalized snapshot score derived from age, availability, failure rate, maintenance burden, risk, spare parts, and cost. Use as decision-support evidence for BME Head; downstream actions (disposal, procurement, specification) persist source_replacement_score_id."
        visibleCounts={{
          replacement_rank: Number(data.replacement_rank ?? 0),
          rpi_x100: Math.round(rpi * 100),
          has_score_row: Boolean(replacementScoreId),
        }}
        pageDataHints={[
          `RPI: ${(rpi * 100).toFixed(1)}/100`,
          `Rank: ${Number(data.replacement_rank ?? 0)}`,
          `Department: ${data.department_name ?? 'Unknown'}`,
          'Lifecycle linkage: disposal_requests / procurement_requests / specification_requests carry source_replacement_score_id when created from here.',
          'Score row source: replacement_priority_scores (weights_profile_id IS NULL = canonical computed row).',
        ]}
        availableEvidenceLinks={[
          { label: 'Replacement Evidence', href: `/command/drilldown/replacement/${assetId}`, type: 'replacement' },
          { label: 'Asset', href: `/equipment/${assetId}`, type: 'equipment' },
          { label: 'Replacement Center', href: '/replacement', type: 'module' },
        ]}
        quickPrompts={[
          'Explain this replacement priority index.',
          'What evidence supports replacing this asset?',
          'What downstream records will be linked to this score?',
          'How does this compare to the rest of the fleet?',
        ]}
      />
      <Link href="/command/drilldown/replacement" className="inline-flex items-center gap-1 text-sm text-violet-300"><ArrowLeft className="h-4 w-4" /> Replacement queue</Link>
      <PageHeader title={`Replacement evidence — ${data.asset_name ?? 'Asset'}`} description={`${data.asset_code ?? 'N/A'} · ${data.department_name ?? 'Unknown'}`} />
      <Card>
        <CardHeader><CardTitle>Lifecycle Evidence</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="warning">Rank {Number(data.replacement_rank ?? 0)}</Badge>
            <ScoreExplanation details={{
              title: `Replacement Priority Index — ${data.asset_name ?? 'Asset'}`,
              scoreLabel: `RPI ${Math.round(rpi * 100)}/100`,
              formula: 'weighted sum of normalized criteria × 100',
              criteria: ['Availability', 'Age', 'Failure rate', 'Maintenance burden', 'Risk/RPN', 'Spare parts', 'Cost'],
              weights: [
                { label: 'Availability', value: '20%' },
                { label: 'Age', value: '15%' },
                { label: 'Failure rate', value: '15%' },
                { label: 'Maintenance burden', value: '15%' },
                { label: 'Risk/RPN', value: '15%' },
                { label: 'Spare parts', value: '10%' },
                { label: 'Cost', value: '10%' },
              ],
              normalizedValues: [
                { label: 'Availability score', value: data.availability_score as number | null },
                { label: 'Age score', value: data.age_score as number | null },
                { label: 'Failure score', value: data.failure_score as number | null },
                { label: 'Maintenance burden', value: data.maintenance_burden_score as number | null },
                { label: 'Risk score', value: data.risk_score as number | null },
                { label: 'Spare part score', value: data.spare_part_score as number | null },
                { label: 'Cost score', value: data.cost_score as number | null },
              ],
              rawValues: [{ label: 'Rank', value: Number(data.replacement_rank ?? 0) }],
              calculation: `RPI = ${Math.round(rpi * 100)}/100`,
              generatedReason: reason,
              source: 'v_replacement_decision / replacement_priority_scores',
              assignmentMethod: 'Computed',
              actionSuggestion: 'Use as evidence for BME Head lifecycle decision.',
            }}>RPI {Math.round(rpi * 100)}/100</ScoreExplanation>
          </div>
          <p className="text-sm text-[var(--foreground)]">{reason}</p>
          {canMutate && (
            <Link href={replacementReportPrefill(assetId, { reason, rank: Number(data.replacement_rank ?? 0), rpi: Math.round(rpi * 100) })} className="inline-flex rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white">
              Add to Report
            </Link>
          )}
        </CardContent>
      </Card>

      {canMutate && (
        <Card>
          <CardHeader>
            <CardTitle>Start Lifecycle Planning (R32)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Turn this replacement recommendation into a governed lifecycle action. Final approval remains
              with BME Head — these buttons prefill the corresponding request form and persist the
              source replacement-score id so reports can trace each action back to its evidence.
            </p>
            {!replacementScoreId && (
              <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                No computed replacement-priority score row found for this asset. Lifecycle planning launchers will
                still prefill the asset, but the source_replacement_score_id linkage will be empty.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/disposal?action=new-request&source=replacement-evidence&assetId=${encodeURIComponent(assetId)}&reason=${encodeURIComponent(reason)}${replacementScoreId ? `&source_replacement_score_id=${encodeURIComponent(replacementScoreId)}` : ''}`}
                className="inline-flex items-center rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-200 hover:bg-rose-500/20"
              >
                Open disposal request
              </Link>
              <Link
                href={`/procurement?source=replacement-evidence&assetId=${encodeURIComponent(assetId)}&itemName=${encodeURIComponent(data.asset_name ?? 'Asset replacement')}&reason=${encodeURIComponent(reason)}${replacementScoreId ? `&source_replacement_score_id=${encodeURIComponent(replacementScoreId)}` : ''}`}
                className="inline-flex items-center rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-200 hover:bg-violet-500/20"
              >
                Start replacement procurement spec
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
