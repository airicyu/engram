/** @typedef {"zh-Hant" | "en"} Locale */

import zhHant from "./i18n/zh-Hant.json";
import en from "./i18n/en.json";

const STORAGE_KEY = "engram.locale";
const SUPPORTED = /** @type {const} */ (["zh-Hant", "en"]);

/** @type {Record<Locale, Record<string, string>>} */
const catalogs = {
  "zh-Hant": zhHant,
  en,
};

/** @type {Record<string, string>} */
let catalog = catalogs["zh-Hant"];
/** @type {Locale} */
let locale = "zh-Hant";

/**
 * @param {string} code
 * @returns {Locale}
 */
export function normalizeLocale(code) {
  if (code === "en" || code === "zh-Hant") return code;
  return "zh-Hant";
}

/**
 * @returns {Locale}
 */
function detectLocale() {
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

/**
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 */
export function t(key, vars) {
  let s = catalog[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

/** @returns {Locale} */
export function getLocale() {
  return locale;
}

/**
 * Apply static `data-i18n` / `data-i18n-placeholder` / `data-i18n-aria` / `data-i18n-title` markers.
 */
export function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && "placeholder" in el) {
      /** @type {HTMLInputElement | HTMLTextAreaElement} */ (el).placeholder = t(key);
    }
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key) el.setAttribute("aria-label", t(key));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (key) el.setAttribute("title", t(key));
  });
}

/**
 * @param {string} code
 * @param {{ persist?: boolean }} [opts]
 */
export async function setLocale(code, opts = {}) {
  const next = normalizeLocale(code);
  catalog = catalogs[next];
  locale = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    applyStaticI18n();
    document.querySelectorAll("[data-locale]").forEach((btn) => {
      const on = btn.getAttribute("data-locale") === next;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }
  if (opts.persist !== false && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }
  return next;
}

/** @returns {Promise<Locale>} */
export async function initI18n() {
  const initial = detectLocale();
  await setLocale(initial, { persist: true });
  return locale;
}

export { SUPPORTED };
