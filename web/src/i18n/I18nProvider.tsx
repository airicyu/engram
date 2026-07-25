import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import zhHant from "./zh-Hant.json";
import en from "./en.json";

export type Locale = "zh-Hant" | "en";

const STORAGE_KEY = "engram.locale";
const catalogs: Record<Locale, Record<string, string>> = {
  "zh-Hant": zhHant as Record<string, string>,
  en: en as Record<string, string>,
};

function normalizeLocale(code: string): Locale {
  if (code === "en" || code === "zh-Hant") return code;
  return "zh-Hant";
}

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLocale(stored);
  } catch {
    // ignore
  }
  const nav = (navigator.language || "").toLowerCase();
  if (
    nav.startsWith("zh-tw") ||
    nav.startsWith("zh-hk") ||
    nav.startsWith("zh-hant") ||
    nav === "zh"
  ) {
    return "zh-Hant";
  }
  if (nav.startsWith("en")) return "en";
  return "zh-Hant";
}

type I18nValue = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (code: string) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = catalogs[locale][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{${k}}`, String(v));
        }
      }
      return s;
    },
    [locale],
  );

  const setLocale = useCallback((code: string) => {
    setLocaleState(normalizeLocale(code));
  }, []);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside provider");
  return ctx;
}
