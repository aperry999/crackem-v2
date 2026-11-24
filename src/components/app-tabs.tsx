import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.backgroundElement}
      indicatorColor={colors.backgroundSelected}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Tonight</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="moon.stars" md="nightlight" selectedColor={colors.amber} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nearby">
        <NativeTabs.Trigger.Label>Nearby</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map" md="map" selectedColor={colors.amber} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="city">
        <NativeTabs.Trigger.Label>My city</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="flag" md="flag" selectedColor={colors.amber} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="you">
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" selectedColor={colors.amber} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
