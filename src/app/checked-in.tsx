import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Eyebrow, Screen, Title } from '@/components/ui';
import { ASKABLE, openReward, reportAttribute, type OpenedReward } from '@/lib/api';
import { clock } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

export default function CheckedIn() {
  const p = useLocalSearchParams<{ venue: string; venueId: string; checkin: string; visited: string; total: string; first: string; grant: string; ask: string }>();
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
      <OneQuestion venueId={p.venueId} checkinId={Number(p.checkin)} ask={p.ask} />
      <Button label="Back to tonight" kind="quiet" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}

/** One quick question for a field Instagram rarely shows, plus a wrong-hours flag. */
function OneQuestion({ venueId, checkinId, ask }: { venueId: string; checkinId: number; ask: string }) {
  const [done, setDone] = useState<string[]>([]);
  const q = ASKABLE.find(([k]) => k === ask);
  const answer = (attribute: string, value: string) =>
    reportAttribute(venueId, checkinId, attribute, value).then(() => setDone((d) => [...d, attribute])).catch(() => {});
  return (
    <View style={{ gap: 10 }}>
      {q && !done.includes(q[0]) && (
        <Card style={{ flexDirection: 'column' }}>
          <ThemedText style={{ fontWeight: 700 }}>Quick one: {q[1]}</ThemedText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[['yes', 'Yes'], ['no', 'No'], ['not_sure', 'Not sure']].map(([v, label]) => (
              <View key={v} style={{ flex: 1 }}>
                <Button kind="quiet" label={label} onPress={() => answer(q[0], v)} />
              </View>
            ))}
          </View>
        </Card>
      )}
      {q && done.includes(q[0]) && <ThemedText type="small" themeColor="textSecondary">Thanks. That helps the next person.</ThemedText>}
      {!done.includes('hours_wrong') ? (
        <Button kind="quiet" label="Hours look wrong?" onPress={() => answer('hours_wrong', 'flagged')} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">Thanks. We’ll check their hours.</ThemedText>
      )}
    </View>
  );
}
