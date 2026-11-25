import { useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { EventsHome } from '@/components/events-home';
import { PlacesHome } from '@/components/places-home';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Eyebrow, Screen, Title } from '@/components/ui';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { supabaseConfigured } from '@/lib/supabase';
import { useLocation } from '@/lib/use-location';
import { useTheme } from '@/hooks/use-theme';

const today = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function Tonight() {
  const { coords, denied } = useLocation();
  const prefs = usePrefs();
  const theme = useTheme();
  const [reload, setReload] = useState(0);

  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={() => setReload((n) => n + 1)} />}>
      <View style={{ gap: 4 }}>
        <Eyebrow>{today.format(new Date()).toUpperCase()}</Eyebrow>
        <Title>Tonight</Title>
      </View>
      <Segmented
        label="Home view"
        value={prefs.home_view}
        onChange={(v) => setPrefs({ home_view: v })}
        options={[{ value: 'places', label: 'Near me' }, { value: 'events', label: 'Events' }]}
      />
      {denied && <ThemedText type="small" themeColor="textSecondary">Location is off, so distances are from downtown Orlando.</ThemedText>}
      {!supabaseConfigured && <ThemedText themeColor="warn">Backend not configured. Copy .env.example to .env.</ThemedText>}
      {supabaseConfigured && !coords && <ActivityIndicator color={theme.amber} />}
      {supabaseConfigured && coords && (prefs.home_view === 'events'
        ? <EventsHome coords={coords} reload={reload} />
        : <PlacesHome coords={coords} reload={reload} />)}
    </Screen>
  );
}
