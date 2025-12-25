export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const flo = Math.floor(abs);
  const frac = abs - flo;
  const rounded = flo + (frac >= 0.5 ? 1 : 0);
  return sign * rounded;
}
