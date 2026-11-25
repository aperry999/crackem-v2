// The user's home view and saved group. Kept on the phone so it works before sign-in,
// and copied to the profile when signed in so it follows them to a new phone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { getProfilePrefs, saveProfilePrefs, type Prefs } from './api';
import { supabase } from './supabase';

const KEY = 'crackem.prefs.v1';
let prefs: Prefs = { home_view: 'places', with_kids: false, with_dog: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

AsyncStorage.getItem(KEY)
  .then((s) => {
    if (s) {
      prefs = { ...prefs, ...JSON.parse(s) };
      emit();
    }
  })
  .catch(() => {});

// On sign-in, the saved profile wins over what's on the phone.
supabase.auth.onAuthStateChange((_e, session) => {
  if (!session) return;
  getProfilePrefs(session.user.id)
    .then((p) => {
      if (p) {
        prefs = { ...prefs, ...p };
        AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
        emit();
      } else {
        saveProfilePrefs(session.user.id, prefs).catch(() => {});
      }
    })
    .catch(() => {});
});

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) saveProfilePrefs(data.session.user.id, prefs).catch(() => {});
  });
}

export function usePrefs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs,
  );
}
