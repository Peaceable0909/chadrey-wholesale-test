/*
 * The look of the site: white (the "light" look) unless the visitor picks something else in Settings.
 *
 * The site used to follow the phone's own dark mode by itself, so a phone set to dark showed the whole shop in navy.
 * Now white is always the starting point. "Dark" and "Auto" (follow the device) are things a visitor chooses, and the
 * choice is kept in this browser, so it works without signing in. The little script in client/index.html does the same
 * job as these helpers before the page is drawn (so there is no flash); theme.test.ts runs that script against them.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "chadrey-theme";

/** White. */
export const DEFAULT_THEME: ThemePreference = "light";

/** The colour of the phone's browser bar behind the page for each look (white, and the dark page colour). */
export const THEME_BAR_COLOURS: Record<ResolvedTheme, string> = { light: "#ffffff", dark: "#07172e" };

export const THEME_CHOICES: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "White" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

/** Anything that is not one of the three known choices (an old or damaged saved value) means the default. */
export function parseThemePreference(raw: unknown): ThemePreference {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : DEFAULT_THEME;
}

export function resolveTheme(preference: ThemePreference, deviceIsDark: boolean): ResolvedTheme {
  if (preference === "system") return deviceIsDark ? "dark" : "light";
  return preference;
}

type StorageRead = Pick<Storage, "getItem">;
type StorageWrite = Pick<Storage, "setItem">;

/** Browsers can refuse storage (private windows, blocked site data), so every use is wrapped. */
function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readThemePreference(storage: StorageRead | null = browserStorage()): ThemePreference {
  try {
    return parseThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveThemePreference(preference: ThemePreference, storage: StorageWrite | null = browserStorage()): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The choice then lasts only until the page is closed.
  }
}

type ElementLike = { setAttribute(name: string, value: string): void };
type DocumentLike = { documentElement: ElementLike & { style: { colorScheme: string } }; querySelector(selector: string): ElementLike | null };

/** Puts the look on the page: the colours (data-theme), the browser's own controls (color-scheme) and the phone's browser bar. */
export function applyTheme(theme: ResolvedTheme, doc: DocumentLike = document): void {
  doc.documentElement.setAttribute("data-theme", theme);
  doc.documentElement.style.colorScheme = theme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_BAR_COLOURS[theme]);
}
