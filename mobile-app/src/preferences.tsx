import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ColorMode = 'system' | 'light' | 'dark';
export type TextSize = 'normal' | 'large' | 'extraLarge';

interface Preferences {
  colorMode: ColorMode;
  textSize: TextSize;
}

interface PreferencesContextValue extends Preferences {
  loading: boolean;
  save: (changes: Partial<Preferences>) => Promise<void>;
}

const storageKey = 'supaclothes.preferences';
const defaults: Preferences = { colorMode: 'system', textSize: 'normal' };
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey)
      .then(stored => {
        if (!active || !stored) return;
        const value: Partial<Preferences> = JSON.parse(stored);
        setPreferences({
          colorMode: value.colorMode === 'light' || value.colorMode === 'dark' ? value.colorMode : defaults.colorMode,
          textSize: value.textSize === 'large' || value.textSize === 'extraLarge' ? value.textSize : defaults.textSize,
        });
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(changes: Partial<Preferences>) {
    const next = { ...preferences, ...changes };
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    setPreferences(next);
  }

  return (
    <PreferencesContext.Provider value={{ ...preferences, loading, save }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error('PreferencesProvider es obligatorio.');
  return preferences;
}
