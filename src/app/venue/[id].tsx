import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Eyebrow, Heading, Screen, TierBadge, Title } from '@/components/ui';
import { ASKABLE, checkIn, cityProgress, getVenue, venueEvents, venueStatus, type Venue, type VenueEvent } from '@/lib/api';
import { clock } from '@/lib/format';
import { drinkBadges, foodSummary, groupLabels, seatingBadges, type FoodTonight } from '@/lib/group-fit';
import { currentFix } from '@/lib/use-location';
import { useSession } from '@/lib/use-session';

const TIER_LINE = {
  listed: 'From public posts. This brewery hasn’t joined Crackem yet, so check before you go.',
  connected: 'Events come from their website and Instagram, checked every night.',
  verified: 'Run by the brewery. Updates come straight from the taproom.',
} as const;

const HOURS_LINE = {
  website: 'Hours from their website',
  brewery: 'Hours set by the brewery',
} as const;

function localDate(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 10);
}

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [progress, setProgress] = useState<{ visited: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ open_now: boolean | null; closes_at: string | null } | null>(null);

  useEffect(() => {
    getVenue(id).then((v) => {
      setVenue(v);
      if (session) cityProgress(v.market_id).then(setProgress).catch(() => {});
    });
    venueEvents(id, localDate()).then(setEvents).catch(() => {});
    venueStatus(id).then(setStatus).catch(() => {});
  }, [id, session]);

  async function onCheckIn() {
    if (!session) {
      router.push('/you');
      return;
    }
    setBusy(true);
    try {
      const here = await currentFix();
      const r = await checkIn(id, here.lat, here.lon);
      if (!r.ok) {
        Alert.alert(r.reason === 'too_far' ? 'Not quite there' : 'Already checked in',
          r.reason === 'too_far' ? 'Check in once you’re at the brewery.' : 'You checked in here in the last few hours.');
        return;
      }
      const ask = ASKABLE.find(([k]) => (venue?.group_fit[k]?.value ?? 'unknown') === 'unknown');
      router.push({
        pathname: '/checked-in',
        params: {
          venue: venue?.name ?? '', venueId: id, checkin: r.checkin_id, visited: r.visited, total: r.total,
          first: r.first_visit ? '1' : '', grant: r.reward_grant_id ?? '', ask: ask?.[0] ?? '',
        },
      });
    } catch (e) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!venue) return <Screen tabs={false}><ThemedText themeColor="textSecondary">Loading…</ThemedText></Screen>;
  const today = localDate();
  const tonight = events.filter((e) => e.event_date === today);
  const week = events.filter((e) => e.event_date !== today);

  return (
    <Screen tabs={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
        <ThemedText themeColor="amberInk">‹ Back</ThemedText>
      </Pressable>
      <View style={{ gap: 6 }}>
        {venue.town && <Eyebrow>{venue.town.toUpperCase()}</Eyebrow>}
        <Title>{venue.name}</Title>
        <ThemedText type="small" themeColor={status?.open_now ? 'hop' : 'textSecondary'}>
          {status?.open_now === true ? `Open till ${clock(status.closes_at)} · ` : status?.open_now === false ? 'Closed now · ' : ''}
          {venue.hours_source ? HOURS_LINE[venue.hours_source] : 'Hours not published'}
        </ThemedText>
      </View>
      <Card style={{ alignItems: 'flex-start' }}>
        <TierBadge tier={venue.tier} />
        <ThemedText type="small" style={{ flex: 1 }}>{TIER_LINE[venue.tier]}</ThemedText>
      </Card>

      <WhatsHere venue={venue} food={tonight.find((e) => e.category?.startsWith('food_truck') && (!e.ends_at || new Date(e.ends_at) > new Date())) ?? null} />

      <View style={{ gap: 8 }}>
        <Heading>Tonight</Heading>
        {tonight.length === 0 && <ThemedText themeColor="textSecondary">Nothing posted for tonight.</ThemedText>}
        {tonight.map((e) => <EventLine key={e.id} e={e} />)}
      </View>
      {week.length > 0 && (
        <View style={{ gap: 8 }}>
          <Heading>This week</Heading>
          {week.map((e) => <EventLine key={e.id} e={e} day />)}
        </View>
      )}
      {progress && (
        <Card>
          <ThemedText type="small">You’ve been to {progress.visited} of {progress.total} breweries in this city.</ThemedText>
        </Card>
      )}
      <Button label={busy ? 'Checking in…' : 'I’m here: check in'} onPress={onCheckIn} disabled={busy} />
    </Screen>
  );
}

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });

function EventLine({ e, day }: { e: VenueEvent; day?: boolean }) {
  const when = [day ? dayFmt.format(new Date(e.event_date)) : '', e.starts_at ? clock(e.starts_at) : day ? '' : 'All night']
    .filter(Boolean).join(' ');
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
      <ThemedText type="code" themeColor="amberInk" style={{ width: 72 }}>{when}</ThemedText>
      <ThemedText style={{ flex: 1 }}>{e.title}</ThemedText>
    </View>
  );
}

/** The decision points in the doc's order: food, non-beer drinks, NA, seating, kids and dogs. */
function WhatsHere({ venue, food }: { venue: Venue; food: FoodTonight }) {
  const gf = venue.group_fit ?? {};
  const rows: [string, string | null][] = [
    ['Food', (({ text, has }) => (has === null && text === 'Food unconfirmed' ? null : text))(foodSummary(gf, food))],
    ['Drinks', drinkBadges(gf).join(' · ') || null],
    ['Seating', seatingBadges(gf).join(' · ') || null],
    ['Kids and dogs', groupLabels(gf).join(' · ') || null],
  ];
  return (
    <View style={{ gap: 8 }}>
      <Heading>What’s here</Heading>
      {rows.map(([label, value]) => (
        <View key={label} style={{ flexDirection: 'row', gap: 12 }}>
          <ThemedText type="smallBold" style={{ width: 104 }}>{label}</ThemedText>
          <ThemedText type="small" themeColor={value ? 'text' : 'textSecondary'} style={{ flex: 1 }}>{value ?? 'Unconfirmed'}</ThemedText>
        </View>
      ))}
    </View>
  );
}
