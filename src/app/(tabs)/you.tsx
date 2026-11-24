import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Eyebrow, Screen, Title } from '@/components/ui';
import { deleteMyAccount, sendCode, verifyCode } from '@/lib/api';
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
