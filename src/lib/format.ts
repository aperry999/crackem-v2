const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export function clock(iso: string | null) {
  if (!iso) return '';
  return timeFmt.format(new Date(iso)).replace(':00', '').replace(' ', '').toLowerCase();
}

export function miles(m: number) {
  return m < 0.95 ? `${m.toFixed(1)} mi` : `${Math.round(m * 10) / 10} mi`;
}

export function isOnNow(e: { starts_at: string | null; ends_at: string | null }, now = new Date()) {
  if (!e.starts_at) return false;
  const s = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 2 * 3600e3);
  return s <= now && now < end;
}

export const TIER_LABEL = { listed: 'LISTED', connected: 'CONNECTED', verified: 'VERIFIED' } as const;
