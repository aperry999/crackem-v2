import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, TierBadge } from '@/components/ui';
import { homePlaces, type HomePlace } from '@/lib/api';
import { clock, isOnNow, miles } from '@/lib/format';
import { drinkBadges, foodSummary, groupLabels } from '@/lib/group-fit';
import { usePrefs } from '@/lib/prefs';
import type { Coords } from '@/lib/use-location';
import { useTheme } from '@/hooks/use-theme';

/** Location-based home (the default): open breweries near you, each with what's on tonight. */
export function PlacesHome({ coords, reload }: { coords: Coords; reload: number }) {
  const theme = useTheme();
  const prefs = usePrefs();
  const [places, setPlaces] = useState<HomePlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foodOnly, setFoodOnly] = useState(false);

  useEffect(() => {
    homePlaces(coords.lat, coords.lon, { kids: prefs.with_kids, dog: prefs.with_dog })
      .then((p) => { setPlaces(p); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [coords, reload, prefs.with_kids, prefs.with_dog]);

  if (error) return <ThemedText themeColor="warn">{error}</ThemedText>;
  if (!places) return <ActivityIndicator color={theme.amber} />;
  if (places.length === 0) return <ThemedText themeColor="textSecondary">Nothing open near you right now.</ThemedText>;

  const group = [prefs.with_kids && 'kids', prefs.with_dog && 'a dog'].filter(Boolean).join(' and ');
  const now = new Date();
  const rows = places.map((p) => ({ p, food: foodSummary(p.group_fit, foodOf(p), now) }));
  const shown = foodOnly ? rows.filter((r) => r.food.has) : rows;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row' }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: foodOnly }}
          onPress={() => setFoodOnly(!foodOnly)}
          style={{
            minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center',
            backgroundColor: foodOnly ? theme.amber : theme.backgroundSelected,
          }}>
          <ThemedText type="smallBold">Food tonight</ThemedText>
        </Pressable>
      </View>
      {group ? <ThemedText type="small" themeColor="textSecondary">Showing places that work with {group}. Change this on the You tab.</ThemedText> : null}
      {shown.length === 0 && <ThemedText themeColor="textSecondary">No food posted nearby yet tonight.</ThemedText>}
      {shown.map(({ p, food }) => <PlaceCard key={p.venue_id} p={p} food={food} now={now} />)}
    </View>
  );
}

const foodOf = (p: HomePlace) =>
  p.food_title ? { title: p.food_title, starts_at: p.food_starts_at, ends_at: p.food_ends_at } : null;

function PlaceCard({ p, food, now }: { p: HomePlace; food: ReturnType<typeof foodSummary>; now: Date }) {
  const drinks = drinkBadges(p.group_fit);
  const labels = groupLabels(p.group_fit, now);
  const closingSoon = p.closes_at && new Date(p.closes_at).getTime() - now.getTime() < 45 * 60e3;
  const hours = p.open_now ? `Open till ${clock(p.closes_at)}` : 'Hours unconfirmed';
  const eventOn = p.event_starts_at ? isOnNow({ starts_at: p.event_starts_at, ends_at: null }, now) || p.event_on_now : false;

  return (
    <Card href={`/venue/${p.venue_id}`} style={{ flexDirection: 'column', gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <ThemedText style={{ fontWeight: 700, flex: 1 }}>{p.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{miles(p.miles)}</ThemedText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ThemedText type="small" themeColor={p.open_now ? (closingSoon ? 'warn' : 'hop') : 'textSecondary'}>
          {closingSoon ? `Closes ${clock(p.closes_at)}` : hours}
        </ThemedText>
        <TierBadge tier={p.tier} />
      </View>
      <ThemedText type="small" themeColor={food.has ? 'text' : 'textSecondary'} style={food.has ? { fontWeight: 600 } : undefined}>
        {food.text}
      </ThemedText>
      {p.event_title && (
        <ThemedText type="small" themeColor="amberInk">
          {eventOn ? 'On now: ' : p.event_starts_at ? `${clock(p.event_starts_at)}: ` : 'Tonight: '}{p.event_title}
        </ThemedText>
      )}
      {drinks.length > 0 && <ThemedText type="small" themeColor="textSecondary">{drinks.join(' · ')}</ThemedText>}
      {(labels.length > 0 || p.fits === null) && (
        <ThemedText type="small" themeColor="textSecondary">
          {[...labels, p.fits === null ? 'Kids/dogs unconfirmed' : null].filter(Boolean).join(' · ')}
        </ThemedText>
      )}
    </Card>
  );
}
