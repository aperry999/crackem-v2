import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

// Web build (used for previews and a possible web beta): a plain bottom bar.
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <ThemedView type="backgroundElement" style={styles.bar}>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Tonight</TabButton>
          </TabTrigger>
          <TabTrigger name="nearby" href="/nearby" asChild>
            <TabButton>Nearby</TabButton>
          </TabTrigger>
          <TabTrigger name="city" href="/city" asChild>
            <TabButton>My city</TabButton>
          </TabTrigger>
          <TabTrigger name="you" href="/you" asChild>
            <TabButton>You</TabButton>
          </TabTrigger>
        </ThemedView>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  // TabTriggerSlotProps carries a ref type Pressable doesn't accept; the rest passes straight through.
  const { ref: _ref, ...rest } = props as TabTriggerSlotProps & { ref?: unknown };
  return (
    <Pressable {...(rest as PressableProps)} style={styles.button}>
      <ThemedText type="smallBold" themeColor={isFocused ? 'amberInk' : 'textSecondary'}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e2dccf' },
  button: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
