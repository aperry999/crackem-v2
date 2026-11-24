import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Eyebrow, Screen, Title } from '@/components/ui';
import { openReward, type OpenedReward } from '@/lib/api';
import { clock } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

export default function CheckedIn() {
  const p = useLocalSearchParams<{ venue: string; visited: string; total: string; first: string; grant: string }>();
  const theme = useTheme();
  const [reward, setReward] = useState<OpenedReward | null>(null);
  const visited = Number(p.visited), total = Number(p.total);

  return (
    <Screen tabs={false}>
      <View style={{ gap: 6, alignItems: 'center' }}>
        <Eyebrow>CHECKED IN</Eyebrow>
        <Title>{p.venue}</Title>
      </View>
      <Card style={{ flexDirection: 'column' }}>
        <ThemedText style={{ fontWeight: 700 }}>{visited} of {total} in this city</ThemedText>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
          <View style={{ width: `${total ? (visited / total) * 100 : 0}%`, height: '100%', backgroundColor: theme.amber }} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {p.first ? 'A new one for you.' : 'Good to be back.'} {Math.max(total - visited, 0)} to go.
        </ThemedText>
      </Card>

      {p.grant && !reward && (
        <Button kind="quiet" label="Something turned up. Tap to open" onPress={() => openReward(Number(p.grant)).then(setReward)} />
      )}
      {reward && (
        <View style={{ gap: 10, padding: 20, borderRadius: 20, backgroundColor: '#1f1a14' }}>
          <ThemedText style={{ color: '#f0b85e' }} type="code">A LITTLE SOMETHING · ON CRACKEM</ThemedText>
          <ThemedText style={{ color: '#f7f5ef', fontSize: 26, lineHeight: 30, fontWeight: 800 }}>{reward.title}</ThemedText>
          {reward.details && <ThemedText style={{ color: '#d9cfbf' }}>{reward.details}</ThemedText>}
          <ThemedText style={{ color: '#f7f5ef', fontSize: 20, letterSpacing: 2 }} type="code">{reward.code}</ThemedText>
          <ThemedText type="small" style={{ color: '#d9cfbf' }}>Show this at the bar. Ends {clock(reward.expires_at)}.</ThemedText>
        </View>
      )}
      <Button label="Back to tonight" kind="quiet" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}
