/** Normalize Expo Router search params that may be `string | string[]`. */
export function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0] || undefined;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
