import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Fonts, MaxContentWidth } from '@/constants/theme';
import type { Tier } from '@/lib/api';
import { TIER_LABEL } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

export function Screen({ children, tabs = true, refreshControl }: {
  children: ReactNode; tabs?: boolean; refreshControl?: ScrollViewProps['refreshControl'];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      refreshControl={refreshControl}
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + (tabs ? BottomTabInset : 0) + 24,
        paddingHorizontal: 18,
        gap: 18,
        width: '100%',
        maxWidth: MaxContentWidth,
        alignSelf: 'center',
      }}>
      {children}
    </ScrollView>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <ThemedText themeColor="amberInk" style={styles.eyebrow}>
      {children}
    </ThemedText>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <ThemedText style={styles.title}>{children}</ThemedText>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <ThemedText style={styles.heading}>{children}</ThemedText>;
}

export function Card({ href, children, style }: { href?: Href; children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  const box = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.line }, style];
  if (!href) return <View style={box}>{children}</View>;
  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => [box, pressed && { borderColor: theme.amber }]}>{children}</Pressable>
    </Link>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  const bg = { listed: '#f1ead9', connected: '#f0b85e', verified: '#8fbf5a' }[tier];
  const ink = tier === 'listed' ? '#6b6256' : '#1f1a14';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText style={[styles.badgeText, { color: ink }]}>{TIER_LABEL[tier]}</ThemedText>
    </View>
  );
}

export function Button({ label, onPress, kind = 'primary', disabled }: {
  label: string; onPress: () => void; kind?: 'primary' | 'quiet'; disabled?: boolean;
}) {
  const theme = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: theme.amber } : { borderWidth: 1, borderColor: theme.line },
        (pressed || disabled) && { opacity: 0.6 },
      ]}>
      <ThemedText style={[styles.buttonText, primary && { color: '#1f1a14' }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  title: { fontSize: 40, lineHeight: 44, fontWeight: 800 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: 700 },
  card: { flexDirection: 'row', gap: 12, padding: 14, borderWidth: 1, borderRadius: 16 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontFamily: Fonts.mono, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.5 },
  button: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { fontSize: 16, fontWeight: 700 },
});
