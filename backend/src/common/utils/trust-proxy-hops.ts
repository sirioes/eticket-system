export const DEFAULT_TRUST_PROXY_HOPS = 1;
export const MAX_TRUST_PROXY_HOPS = 10;

export function parseTrustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_TRUST_PROXY_HOPS;

  const value = raw.trim();

  if (!/^\d+$/.test(value) || Number(value) > MAX_TRUST_PROXY_HOPS) {
    throw new Error(
      `TRUST_PROXY_HOPS must be an integer between 0 and ${MAX_TRUST_PROXY_HOPS}`,
    );
  }

  return Number(value);
}
