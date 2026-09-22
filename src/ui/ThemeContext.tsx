import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import { type ColorPalette, type ColorScheme, palettes } from "./theme";

export type ThemeMode = "system" | "light" | "dark";

export interface Theme {
  colors: ColorPalette;
  /** Resolved scheme after applying the mode preference. */
  scheme: ColorScheme;
  /** The user's stored preference. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "medtrace.themeMode";

const ThemeContext = createContext<Theme | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

/** Mount once at the root, above everything that renders color. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (isThemeMode(stored)) setModeState(stored);
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: ColorScheme =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  // Memoized so a parent re-render does not re-render every theme consumer.
  const value = useMemo<Theme>(
    () => ({ colors: palettes[scheme], scheme, mode, setMode }),
    [scheme, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Current palette. Every component resolves color through this. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
