/**
 * Core analytical formulas from the thesis proposal.
 * Implements Equations 1-5 for risk, reliability, and PM compliance.
 */

/**
 * Proposal Equation 1: Risk Priority Number (FMEA)
 * RPN = S × O × D
 * S: Severity (1-10), O: Occurrence (1-10), D: Detectability (1-10)
 * Range: 1-1000
 */
export function computeRPN(severity: number, occurrence: number, detectability: number): number {
  if (severity < 1 || severity > 10 || occurrence < 1 || occurrence > 10 || detectability < 1 || detectability > 10) {
    throw new Error('S, O, D values must be between 1 and 10');
  }
  return severity * occurrence * detectability;
}

/**
 * Classify RPN into risk levels for dashboard display.
 */
export function classifyRiskLevel(rpn: number): 'low' | 'medium' | 'high' | 'critical' {
  if (rpn >= 500) return 'critical';
  if (rpn >= 200) return 'high';
  if (rpn >= 80) return 'medium';
  return 'low';
}

/**
 * Proposal Equation 2: Availability
 * A = MTBF / (MTBF + MTTR)
 * Returns a ratio between 0 and 1.
 */
export function computeAvailability(mtbf: number, mttr: number): number | null {
  if (mtbf < 0 || mttr < 0) return null;
  const denominator = mtbf + mttr;
  if (denominator === 0) return null;
  return mtbf / denominator;
}

/**
 * Proposal Equation 3: Mean Time Between Failures
 * MTBF = T_operational / N_failures
 * T_operational in hours, N_failures = count of failure events.
 */
export function computeMTBF(totalOperationalHours: number, failureCount: number): number | null {
  if (failureCount <= 0) return null;
  if (totalOperationalHours < 0) return null;
  return totalOperationalHours / failureCount;
}

/**
 * Proposal Equation 4: Mean Time To Repair
 * MTTR = T_maintenance / N_repairs
 * T_maintenance = sum of repair durations in hours, N_repairs = count of repair events.
 */
export function computeMTTR(totalMaintenanceHours: number, repairCount: number): number | null {
  if (repairCount <= 0) return null;
  if (totalMaintenanceHours < 0) return null;
  return totalMaintenanceHours / repairCount;
}

/**
 * Proposal Equation 5: Preventive Maintenance Compliance
 * PMC = (NPM_completed / NPM_scheduled) × 100
 * Returns percentage (0-100).
 */
export function computePMC(completedCount: number, scheduledCount: number): number | null {
  if (scheduledCount <= 0) return null;
  return (completedCount / scheduledCount) * 100;
}

/**
 * Compute total downtime burden as a percentage of the observation period.
 */
export function computeDowntimeBurden(totalDowntimeHours: number, periodHours: number): number | null {
  if (periodHours <= 0) return null;
  return (totalDowntimeHours / periodHours) * 100;
}

/**
 * Compute annualized failure rate from failure count and observation period.
 */
export function computeAnnualizedFailureRate(failureCount: number, periodDays: number): number | null {
  if (periodDays <= 0) return null;
  return (failureCount / periodDays) * 365;
}
