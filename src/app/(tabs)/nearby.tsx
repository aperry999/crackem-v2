import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Eyebrow, Screen, Title } from '@/components/ui';
import { VenueRow } from '@/components/venue-row';
import { nearbyVenues, type NearbyVenue } from '@/lib/api';
import { supabaseConfigured } from '@/lib/supabase';
import { useLocation } from '@/lib/use-location';

export default function Nearby() {
  const { coords, denied } = useLocation();
  const [venues, setVenues] = useState<NearbyVenue[]>([]);
  useEffect(() => {
    if (coords && supabaseConfigured) nearbyVenues(coords.lat, coords.lon, 25).then(setVenues).catch(() => {});
  }, [coords]);
  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>CLOSEST FIRST</Eyebrow>
        <Title>Nearby</Title>
      </View>
      {denied && <ThemedText themeColor="textSecondary">Location is off, so this is sorted from downtown Orlando.</ThemedText>}
      {venues.map((v) => (
        <VenueRow key={v.venue_id} venue={v} />
      ))}
    </Screen>
  );
}
