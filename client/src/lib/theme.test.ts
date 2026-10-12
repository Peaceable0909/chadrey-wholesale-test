import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyTheme,
  DEFAULT_THEME,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  THEME_BAR_COLOURS,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
} from "./theme";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

/** A page that records what is done to it. */
function fakePage() {
  const attributes: Record<string, string> = {};
  const bar: Record<string, string> = { content: "#ffffff" };
  const style = { colorScheme: "" };
  const document = {
    documentElement: { setAttribute: (name: string, value: string) => void (attributes[name] = value), style },
    querySelector: (selector: string) => (selector === 'meta[name="theme-color"]' ? { setAttribute: (name: string, value: string) => void (bar[name] = value) } : null),
  };
  return { document, attributes, bar, style };
}

const storageWith = (saved: string | null | undefined) => ({ getItem: (key: string) => (key === THEME_STORAGE_KEY && saved !== undefined ? saved : null) });

describe("white is the default", () => {
  it("starts white, and a saved value that is not one of the three choices means white", () => {
    expect(DEFAULT_THEME).toBe("light");
    for (const raw of [undefined, null, "", "Dark", "blue", "auto", 1, true, {}, []]) expect(parseThemePreference(raw)).toBe("light");
    for (const raw of ["light", "dark", "system"] as const) expect(parseThemePreference(raw)).toBe(raw);
  });

  it("offers White first, then Dark and Auto", () => {
    expect(THEME_CHOICES).toEqual([
      { value: "light", label: "White" },
      { value: "dark", label: "Dark" },
      { value: "system", label: "Auto" },
    ]);
  });

  it("is white on a device in dark mode until Dark or Auto is chosen", () => {
    expect(resolveTheme(DEFAULT_THEME, true)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("reads nothing saved as white", () => {
    expect(readThemePreference(storageWith(undefined))).toBe("light");
    expect(readThemePreference(null)).toBe("light");
    expect(readThemePreference(storageWith("dark"))).toBe("dark");
    expect(readThemePreference(storageWith("system"))).toBe("system");
    expect(readThemePreference(storageWith("something old"))).toBe("light");
  });

  it("survives a browser that refuses storage", () => {
    const refusing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readThemePreference(refusing)).toBe("light");
    expect(() => saveThemePreference("dark", refusing)).not.toThrow();
    expect(() => saveThemePreference("dark", null)).not.toThrow();
  });

  it("saves the choice under the key the page script reads", () => {
    const saved: Record<string, string> = {};
    saveThemePreference("system", { setItem: (key, value) => void (saved[key] = value) });
    expect(saved).toEqual({ "chadrey-theme": "system" });
  });
});

describe("applyTheme", () => {
  it("sets the look, the browser's own controls and the phone's browser bar", () => {
    for (const theme of ["light", "dark"] as const) {
      const page = fakePage();
      applyTheme(theme, page.document);
      expect(page.attributes["data-theme"]).toBe(theme);
      expect(page.style.colorScheme).toBe(theme);
      expect(page.bar.content).toBe(THEME_BAR_COLOURS[theme]);
    }
    expect(THEME_BAR_COLOURS.light).toBe("#ffffff");
  });

  it("does not mind a page without the browser-bar tag", () => {
    const page = fakePage();
    page.document.querySelector = () => null;
    expect(() => applyTheme("dark", page.document)).not.toThrow();
    expect(page.attributes["data-theme"]).toBe("dark");
  });
});

describe("the script in index.html (runs before the page is drawn)", () => {
  const html = read("../../index.html");
  const script = html.match(/<script id="theme-init">([\s\S]*?)<\/script>/)?.[1];

  type Run = { saved?: string | null; deviceIsDark?: boolean; storageThrows?: boolean; noMatchMedia?: boolean };

  function runScript({ saved, deviceIsDark = false, storageThrows = false, noMatchMedia = false }: Run) {
    const page = fakePage();
    const localStorage = {
      getItem: (key: string) => {
        if (storageThrows) throw new Error("blocked");
        return key === THEME_STORAGE_KEY && saved !== undefined ? saved : null;
      },
    };
    const matchMedia = noMatchMedia ? undefined : (query: string) => ({ matches: query === "(prefers-color-scheme: dark)" && deviceIsDark });
    new Function("localStorage", "matchMedia", "document", script!)(localStorage, matchMedia, page.document);
    return page;
  }

  it("exists in the head, before the stylesheet and the app are loaded", () => {
    expect(script).toBeTruthy();
    expect(html.indexOf('id="theme-init"')).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
  });

  it("makes the page white when nothing was chosen, even on a device in dark mode", () => {
    const page = runScript({ deviceIsDark: true });
    expect(page.attributes["data-theme"]).toBe("light");
    expect(page.style.colorScheme).toBe("light");
    expect(page.bar.content).toBe("#ffffff");
  });

  it("does the same as the app's own rules for every saved value on every device", () => {
    const saved: Array<string | null | undefined> = [undefined, null, "light", "dark", "system", "auto", "", "Dark", "{}"];
    for (const value of saved) {
      for (const deviceIsDark of [true, false]) {
        const early = runScript({ saved: value, deviceIsDark });
        const app = fakePage();
        applyTheme(resolveTheme(readThemePreference(storageWith(value)), deviceIsDark), app.document);
        expect(early.attributes, `saved ${String(value)}, device dark ${deviceIsDark}`).toEqual(app.attributes);
        expect(early.style.colorScheme).toBe(app.style.colorScheme);
        expect(early.bar.content).toBe(app.bar.content);
      }
    }
  });

  it("goes dark only for Dark, or for Auto on a device in dark mode", () => {
    const looks = (saved: string | undefined, deviceIsDark: boolean): ResolvedTheme => runScript({ saved, deviceIsDark }).attributes["data-theme"] as ResolvedTheme;
    expect(looks("dark", false)).toBe("dark");
    expect(looks("system", true)).toBe("dark");
    expect(looks("system", false)).toBe("light");
    expect(looks("light", true)).toBe("light");
    expect(runScript({ saved: "dark" }).bar.content).toBe(THEME_BAR_COLOURS.dark);
  });

  it("stays white when the browser refuses storage or cannot tell the device's setting", () => {
    expect(runScript({ storageThrows: true, deviceIsDark: true }).attributes["data-theme"]).toBe("light");
    expect(runScript({ saved: "system", noMatchMedia: true }).attributes["data-theme"]).toBe("light");
  });
});

describe("the stylesheet", () => {
  const css = read("../index.css");

  it("never turns dark by itself because the device is in dark mode", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
  });

  it("has the dark colours only under the chosen look, and Tailwind's dark: follows it", () => {
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{\s*color-scheme: dark;/);
    expect(css).toMatch(/@custom-variant dark \(&:where\(\[data-theme="dark"\], \[data-theme="dark"\] \*\)\);/);
  });

  it("starts with the white look on :root", () => {
    expect(css).toMatch(/:root\s*\{\s*color-scheme: light;/);
    expect(css).toMatch(/--surface:\s*#ffffff;/);
  });
});
