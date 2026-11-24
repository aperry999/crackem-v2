import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Eyebrow, Heading, Screen, Title } from '@/components/ui';
import { VenueRow } from '@/components/venue-row';
import { nearbyVenues, THIN_FEED, tonightFeed, type FeedEvent, type NearbyVenue } from '@/lib/api';
import { clock, isOnNow, miles } from '@/lib/format';
import { supabaseConfigured } from '@/lib/supabase';
import { useLocation } from '@/lib/use-location';
import { useTheme } from '@/hooks/use-theme';

const today = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function Tonight() {
  const { coords } = useLocation();
  const theme = useTheme();
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [venues, setVenues] = useState<NearbyVenue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!coords || !supabaseConfigured) return;
    try {
      const ev = await tonightFeed(coords.lat, coords.lon);
      setEvents(ev);
      // Thin night: lead with open breweries nearby instead of an empty feed.
      setVenues(ev.length < THIN_FEED ? await nearbyVenues(coords.lat, coords.lon, 6) : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [coords]);

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  const on = (events ?? []).filter((e) => isOnNow(e, now));
  const later = (events ?? []).filter((e) => e.starts_at && !isOnNow(e, now) && new Date(e.starts_at) > now);
  const allNight = (events ?? []).filter((e) => !e.starts_at);
  const thin = events !== null && events.length < THIN_FEED;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }>
      <View style={{ gap: 4 }}>
        <Eyebrow>{today.format(now).toUpperCase()}</Eyebrow>
        <Title>Tonight</Title>
      </View>

      {!supabaseConfigured && <ThemedText themeColor="warn">Backend not configured. Copy .env.example to .env.</ThemedText>}
      {error && <ThemedText themeColor="warn">{error}</ThemedText>}
      {events === null && supabaseConfigured && !error && <ActivityIndicator color={theme.amber} />}

      {on.length > 0 && <Section title="On now" items={on} />}
      {later.length > 0 && <Section title="Later tonight" items={later} />}
      {allNight.length > 0 && <Section title="All night" items={allNight} />}

      {thin && (
        <View style={{ gap: 10 }}>
          <ThemedText themeColor="textSecondary">
            {events.length === 0 ? 'Quiet night. Nothing posted near you.' : 'Quiet night.'}
          </ThemedText>
          <Heading>Open near you</Heading>
          {venues.map((v) => (
            <VenueRow key={v.venue_id} venue={v} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Section({ title, items }: { title: string; items: FeedEvent[] }) {
  return (
    <View style={{ gap: 10 }}>
      <Heading>{title}</Heading>
      {items.map((e) => (
        <Card key={e.event_id} href={`/venue/${e.venue_id}`}>
          <ThemedText type="code" themeColor="amberInk" style={{ width: 58 }}>
            {e.starts_at ? clock(e.starts_at) : 'All night'}
          </ThemedText>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText style={{ fontWeight: 700 }}>{e.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {e.venue_name} · {miles(e.miles)}
            </ThemedText>
          </View>
        </Card>
      ))}
    </View>
  );
}
