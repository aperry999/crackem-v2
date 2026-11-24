import { supabase } from './supabase';

export type Tier = 'listed' | 'connected' | 'verified';

export type FeedEvent = {
  event_id: string;
  title: string;
  category: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_weekly: boolean;
  source_url: string | null;
  venue_id: string;
  venue_name: string;
  tier: Tier;
  miles: number;
};

export type NearbyVenue = {
  venue_id: string;
  name: string;
  tier: Tier;
  hours: unknown;
  hours_source: 'website' | 'brewery' | null;
  town: string | null;
  miles: number;
};

export type Venue = {
  id: string;
  market_id: string;
  name: string;
  tier: Tier;
  town: string | null;
  website: string | null;
  instagram_handle: string | null;
  hours: unknown;
  hours_source: 'website' | 'brewery' | null;
};

export type VenueEvent = {
  id: string;
  title: string;
  event_date: string;
  starts_at: string | null;
  ends_at: string | null;
  source: string | null;
};

export type CheckInResult =
  | { ok: false; reason: 'too_far' | 'already_checked_in' }
  | { ok: true; checkin_id: number; first_visit: boolean; visited: number; total: number; reward_grant_id: number | null };

export type OpenedReward = { title: string; details: string | null; code: string; expires_at: string };

/** Fewer events than this and the Tonight tab leads with nearby breweries instead. */
export const THIN_FEED = 3;

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function tonightFeed(lat: number, lon: number, radiusMi = 10) {
  return unwrap(await supabase.rpc('tonight_feed', { p_lat: lat, p_lon: lon, p_radius_mi: radiusMi })) as FeedEvent[];
}

export async function nearbyVenues(lat: number, lon: number, limit = 10) {
  return unwrap(await supabase.rpc('nearby_venues', { p_lat: lat, p_lon: lon, p_limit: limit })) as NearbyVenue[];
}

export async function getVenue(id: string) {
  return unwrap(
    await supabase
      .from('venues')
      .select('id, market_id, name, tier, town, website, instagram_handle, hours, hours_source')
      .eq('id', id)
      .single(),
  ) as Venue;
}

export async function venueEvents(id: string, fromDate: string, days = 7) {
  const to = new Date(fromDate);
  to.setDate(to.getDate() + days);
  return unwrap(
    await supabase
      .from('events')
      .select('id, title, event_date, starts_at, ends_at, source')
      .eq('venue_id', id)
      .gte('event_date', fromDate)
      .lte('event_date', to.toISOString().slice(0, 10))
      .order('event_date')
      .order('starts_at', { nullsFirst: true }),
  ) as VenueEvent[];
}

export async function checkIn(venueId: string, lat: number, lon: number) {
  return unwrap(await supabase.rpc('check_in', { p_venue: venueId, p_lat: lat, p_lon: lon })) as CheckInResult;
}

export async function openReward(grantId: number) {
  return unwrap(await supabase.rpc('open_reward', { p_grant: grantId })) as OpenedReward;
}

export async function cityProgress(market: string) {
  const rows = unwrap(await supabase.rpc('city_progress', { p_market: market })) as { visited: number; total: number }[];
  return rows[0] ?? { visited: 0, total: 0 };
}

export async function flagOn(key: string) {
  return unwrap(await supabase.rpc('flag_on', { p_key: key })) as boolean;
}

/** Login by a 6-digit code sent to the email. No passwords (Bubble's can't be migrated). */
export async function sendCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function verifyCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new Error(error.message);
}

export async function deleteMyAccount() {
  unwrap(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut();
}
