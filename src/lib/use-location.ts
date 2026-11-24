import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type Coords = { lat: number; lon: number };

// Fallback when location is off: downtown Orlando (the launch market).
const ORLANDO: Coords = { lat: 28.5383, lon: -81.3792 };

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (live) {
          setDenied(true);
          setCoords(ORLANDO);
        }
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      if (last && live) setCoords({ lat: last.coords.latitude, lon: last.coords.longitude });
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (live) setCoords({ lat: p.coords.latitude, lon: p.coords.longitude });
    })().catch(() => live && setCoords(ORLANDO));
    return () => {
      live = false;
    };
  }, []);

  return { coords, denied };
}

export async function currentFix(): Promise<Coords> {
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lon: p.coords.longitude };
}
