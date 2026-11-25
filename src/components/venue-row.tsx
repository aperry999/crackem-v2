import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, TierBadge } from '@/components/ui';
import type { NearbyVenue } from '@/lib/api';
import { miles } from '@/lib/format';

export function VenueRow({ venue }: { venue: NearbyVenue }) {
  return (
    <Card href={`/venue/${venue.venue_id}`} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 4 }}>
        <ThemedText style={{ fontWeight: 700 }}>{venue.name}</ThemedText>
        <TierBadge tier={venue.tier} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {miles(venue.miles)}
      </ThemedText>
    </Card>
  );
}
