/**
 * Normalization utilities from the thesis proposal.
 * Implements Equation 6: min-max normalization.
 */

/**
 * Proposal Equation 6: Min-Max Normalization
 * NormScore = (value - min) / (max - min)
 * Scales values to [0, 1] range.
 * Returns null if max === min (no variance).
 */
export function minMaxNormalize(value: number, min: number, max: number): number | null {
  if (max === min) return null;
  return (value - min) / (max - min);
}

/**
 * Inverse min-max normalization: higher raw value = lower normalized score.
 * Useful for metrics where lower is better (e.g., MTTR, failure rate).
 * NormScore = 1 - ((value - min) / (max - min))
 */
export function minMaxNormalizeInverse(value: number, min: number, max: number): number | null {
  const normalized = minMaxNormalize(value, min, max);
  if (normalized === null) return null;
  return 1 - normalized;
}

/**
 * Normalize an array of values using min-max normalization.
 * Returns an array of normalized values in the same order.
 * Values where normalization fails (no variance) get 0.5 as default.
 */
export function normalizeArray(values: number[], inverse: boolean = false): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);

  return values.map(v => {
    const fn = inverse ? minMaxNormalizeInverse : minMaxNormalize;
    return fn(v, min, max) ?? 0.5;
  });
}

/**
 * Normalize a record of { id: value } pairs.
 * Returns a record of { id: normalizedValue }.
 */
export function normalizeRecord(
  record: Record<string, number>,
  inverse: boolean = false
): Record<string, number> {
  const entries = Object.entries(record);
  if (entries.length === 0) return {};

  const values = entries.map(([, v]) => v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const fn = inverse ? minMaxNormalizeInverse : minMaxNormalize;

  return Object.fromEntries(
    entries.map(([key, value]) => [key, fn(value, min, max) ?? 0.5])
  );
}
