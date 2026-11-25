import { useState } from 'react';
import { Alert, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Segmented } from '@/components/segmented';
import { Button, Card, Eyebrow, Heading, Screen, Title } from '@/components/ui';
import { deleteMyAccount, sendCode, verifyCode } from '@/lib/api';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/use-session';
import { useTheme } from '@/hooks/use-theme';

export default function You() {
  const { session } = useSession();
  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>YOU</Eyebrow>
        <Title>{session ? 'Your account' : 'Sign in'}</Title>
      </View>
      <Settings />
      {session ? <Account email={session.user.email ?? ''} /> : <SignIn />}
    </Screen>
  );
}

function SignIn() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = { borderWidth: 1, borderColor: theme.line, borderRadius: 12, padding: 14, fontSize: 17, color: theme.text, backgroundColor: theme.backgroundElement };

  async function run(f: () => Promise<void>) {
    setBusy(true);
    try { await f(); } catch (e) { Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <View style={{ gap: 12 }}>
      <ThemedText themeColor="textSecondary">
        We’ll email you a 6-digit code. Already used Crackem? Use the same email and your history comes with you.
      </ThemedText>
      <ThemedText type="smallBold" nativeID="email-label">Email</ThemedText>
      <TextInput accessibilityLabelledBy="email-label" style={input} value={email} onChangeText={setEmail}
        autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!sent} />
      {sent && (
        <>
          <ThemedText type="smallBold" nativeID="code-label">Code</ThemedText>
          <TextInput accessibilityLabelledBy="code-label" style={input} value={code} onChangeText={setCode}
            keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} />
        </>
      )}
      <Button
        disabled={busy}
        label={sent ? 'Sign in' : 'Email me a code'}
        onPress={() => run(async () => {
          if (!sent) { await sendCode(email.trim()); setSent(true); }
          else await verifyCode(email.trim(), code.trim());
        })}
      />
      <ThemedText type="small" themeColor="textSecondary">You must be 21 or older to use Crackem.</ThemedText>
    </View>
  );
}

function Account({ email }: { email: string }) {
  return (
    <View style={{ gap: 12 }}>
      <ThemedText>{email}</ThemedText>
      <Button kind="quiet" label="Sign out" onPress={() => supabase.auth.signOut()} />
      <Button kind="quiet" label="Delete my account" onPress={() =>
        Alert.alert('Delete your account?', 'Your check-ins and rewards are deleted. This can’t be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteMyAccount().catch(() => {}) },
        ])} />
    </View>
  );
}

function Settings() {
  const prefs = usePrefs();
  const theme = useTheme();
  const row = { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, minHeight: 44 };
  return (
    <View style={{ gap: 12 }}>
      <Heading>Home shows</Heading>
      <Segmented
        label="Home shows"
        value={prefs.home_view}
        onChange={(v) => setPrefs({ home_view: v })}
        options={[{ value: 'places', label: 'Breweries near me' }, { value: 'events', label: 'Tonight’s events' }]}
      />
      <Heading>Usually with</Heading>
      <Card style={{ flexDirection: 'column', gap: 4 }}>
        <View style={row}>
          <ThemedText nativeID="kids-label">Kids</ThemedText>
          <Switch accessibilityLabelledBy="kids-label" value={prefs.with_kids} onValueChange={(v) => setPrefs({ with_kids: v })}
            trackColor={{ true: theme.amber }} />
        </View>
        <View style={row}>
          <ThemedText nativeID="dog-label">A dog</ThemedText>
          <Switch accessibilityLabelledBy="dog-label" value={prefs.with_dog} onValueChange={(v) => setPrefs({ with_dog: v })}
            trackColor={{ true: theme.amber }} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Places that don’t allow them drop out of your results. Places we can’t confirm stay in, marked unconfirmed.
        </ThemedText>
      </Card>
    </View>
  );
}
