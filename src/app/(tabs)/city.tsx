import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Eyebrow, Screen, Title } from '@/components/ui';
import { cityProgress } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useTheme } from '@/hooks/use-theme';

// One market for now (Orlando). Picking the market from the user's location comes later.
const MARKET = { id: 'orlando', name: 'Orlando' };

export default function City() {
  const { session } = useSession();
  const theme = useTheme();
  const [p, setP] = useState<{ visited: number; total: number } | null>(null);
  useEffect(() => {
    if (session) cityProgress(MARKET.id).then(setP).catch(() => {});
  }, [session]);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>MY CITY</Eyebrow>
        <Title>{MARKET.name}</Title>
      </View>
      {!session && <ThemedText themeColor="textSecondary">Sign in on the You tab to track the breweries you’ve visited.</ThemedText>}
      {p && (
        <Card style={{ flexDirection: 'column' }}>
          <ThemedText style={{ fontSize: 28, lineHeight: 34, fontWeight: 800 }}>
            {p.visited} <ThemedText themeColor="textSecondary">of {p.total}</ThemedText>
          </ThemedText>
          <ThemedText>{MARKET.name} breweries visited</ThemedText>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
            <View style={{ width: `${p.total ? (p.visited / p.total) * 100 : 0}%`, height: '100%', backgroundColor: theme.amber }} />
          </View>
        </Card>
      )}
    </Screen>
  );
}
