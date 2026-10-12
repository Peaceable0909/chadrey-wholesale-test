import * as React from "react";
import {
  applyTheme,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextType = {
  /** What the visitor chose in Settings: "light" (white, the default), "dark", or "system" (follow the device). */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** The look in use right now. */
  theme: ResolvedTheme;
};

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

const DEVICE_IS_DARK = "(prefers-color-scheme: dark)";

const deviceIsDarkNow = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(DEVICE_IS_DARK).matches);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<ThemePreference>(readThemePreference);
  const [deviceIsDark, setDeviceIsDark] = React.useState(deviceIsDarkNow);
  const theme = resolveTheme(preference, deviceIsDark);

  // The device's own setting only matters while "Auto" is chosen, but following it all the time keeps this simple.
  React.useEffect(() => {
    const query = window.matchMedia?.(DEVICE_IS_DARK);
    if (!query) return;
    const update = () => setDeviceIsDark(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // A choice made in another tab of the site applies here too.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setPreferenceState(readThemePreference());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setPreference = React.useCallback((next: ThemePreference) => {
    const choice = parseThemePreference(next);
    saveThemePreference(choice);
    setPreferenceState(choice);
  }, []);

  const value = React.useMemo(() => ({ preference, setPreference, theme }), [preference, setPreference, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
