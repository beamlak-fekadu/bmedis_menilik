/**
 * Recommendation and alert generation engine.
 * Converts analytics outputs into actionable hospital-level decisions.
 */

import type { RecommendationFlagType, Urgency } from '@/types/database';

export interface RecommendationInput {
  assetId: string;
  assetName: string;
  departmentName: string;
  availability?: number;
  mttr?: number;
  failureCount?: number;
  rpn?: number;
  rpiRank?: number;
  rpiScore?: number;
  pmcPercentage?: number;
  overduePMDays?: number;
  calibrationOverdueDays?: number;
  sparePartShortages?: string[];
  warrantyDaysRemaining?: number;
  contractDaysRemaining?: number;
  daysNonFunctional?: number;
}

export interface GeneratedRecommendation {
  assetId: string;
  flagType: RecommendationFlagType;
  severity: Urgency;
  message: string;
  details: Record<string, unknown>;
}

/**
 * Generate all applicable recommendations for a single asset.
 */
export function generateRecommendations(input: RecommendationInput): GeneratedRecommendation[] {
  const recs: GeneratedRecommendation[] = [];
  const { assetId, assetName, departmentName } = input;

  if (input.daysNonFunctional != null && input.daysNonFunctional > 30) {
    recs.push({
      assetId,
      flagType: 'urgent_maintenance',
      severity: input.daysNonFunctional > 90 ? 'critical' : 'high',
      message: `${assetName} in ${departmentName} has been non-functional for ${input.daysNonFunctional} days.`,
      details: { days_non_functional: input.daysNonFunctional },
    });
  }

  if (input.failureCount != null && input.failureCount >= 4) {
    recs.push({
      assetId,
      flagType: 'recurring_failure',
      severity: input.failureCount >= 6 ? 'critical' : 'high',
      message: `${assetName} has had ${input.failureCount} corrective maintenance events. Investigate root cause.`,
      details: { failure_count: input.failureCount },
    });
  }

  if (input.availability != null && input.availability < 0.95) {
    recs.push({
      assetId,
      flagType: 'low_availability',
      severity: input.availability < 0.90 ? 'critical' : 'high',
      message: `${assetName} availability is ${(input.availability * 100).toFixed(1)}%, below the 95% threshold.`,
      details: { availability: input.availability },
    });
  }

  if (input.rpn != null && input.rpn >= 200) {
    recs.push({
      assetId,
      flagType: 'high_risk',
      severity: input.rpn >= 500 ? 'critical' : 'high',
      message: `${assetName} has an RPN of ${input.rpn}, indicating ${input.rpn >= 500 ? 'critical' : 'high'} risk.`,
      details: { rpn: input.rpn },
    });
  }

  if (input.rpiRank != null && input.rpiRank <= 5) {
    recs.push({
      assetId,
      flagType: 'replacement_candidate',
      severity: input.rpiRank <= 2 ? 'high' : 'medium',
      message: `${assetName} ranks #${input.rpiRank} in replacement priority index (score: ${input.rpiScore?.toFixed(3) ?? 'N/A'}).`,
      details: { rpi_rank: input.rpiRank, rpi_score: input.rpiScore },
    });
  }

  if (input.overduePMDays != null && input.overduePMDays > 0) {
    recs.push({
      assetId,
      flagType: 'overdue_pm',
      severity: input.overduePMDays > 30 ? 'high' : 'medium',
      message: `${assetName} preventive maintenance is overdue by ${input.overduePMDays} days.`,
      details: { days_overdue: input.overduePMDays },
    });
  }

  if (input.pmcPercentage != null && input.pmcPercentage < 70) {
    recs.push({
      assetId,
      flagType: 'prioritize_pm',
      severity: input.pmcPercentage < 50 ? 'high' : 'medium',
      message: `${assetName} PM compliance is ${input.pmcPercentage.toFixed(1)}%. Improve schedule adherence.`,
      details: { pmc_percentage: input.pmcPercentage },
    });
  }

  if (input.calibrationOverdueDays != null && input.calibrationOverdueDays > 0) {
    recs.push({
      assetId,
      flagType: 'calibrate_soon',
      severity: input.calibrationOverdueDays > 30 ? 'high' : 'medium',
      message: `${assetName} calibration is overdue by ${input.calibrationOverdueDays} days.`,
      details: { days_overdue: input.calibrationOverdueDays },
    });
  }

  if (input.sparePartShortages && input.sparePartShortages.length > 0) {
    recs.push({
      assetId,
      flagType: 'part_shortage',
      severity: 'high',
      message: `Spare parts needed for ${assetName}: ${input.sparePartShortages.join(', ')}`,
      details: { parts: input.sparePartShortages },
    });
  }

  if (input.warrantyDaysRemaining != null && input.warrantyDaysRemaining > 0 && input.warrantyDaysRemaining <= 90) {
    recs.push({
      assetId,
      flagType: 'warranty_expiring',
      severity: input.warrantyDaysRemaining <= 30 ? 'high' : 'medium',
      message: `${assetName} warranty expires in ${input.warrantyDaysRemaining} days.`,
      details: { days_remaining: input.warrantyDaysRemaining },
    });
  }

  if (input.contractDaysRemaining != null && input.contractDaysRemaining > 0 && input.contractDaysRemaining <= 90) {
    recs.push({
      assetId,
      flagType: 'contract_expiring',
      severity: input.contractDaysRemaining <= 30 ? 'high' : 'medium',
      message: `${assetName} service contract expires in ${input.contractDaysRemaining} days.`,
      details: { days_remaining: input.contractDaysRemaining },
    });
  }

  if (recs.length === 0 && input.failureCount != null && input.failureCount >= 2) {
    recs.push({
      assetId,
      flagType: 'monitor_closely',
      severity: 'medium',
      message: `${assetName} has had ${input.failureCount} failures. Monitor for further degradation.`,
      details: { failure_count: input.failureCount },
    });
  }

  return recs;
}
