export type ThemePreference = "dark" | "light" | "system";
export type EffectiveTheme = "dark" | "light";

/**
 * Resolve the user's theme preference to a concrete effective theme.
 *
 * - "dark" / "light" — explicit, always wins
 * - "system" — follows the OS preference supplied as `osPrefersDark`
 */
export function resolveTheme(
  pref: ThemePreference | string | null | undefined,
  osPrefersDark: boolean,
): EffectiveTheme {
  if (pref === "light") return "light";
  if (pref === "system") return osPrefersDark ? "dark" : "light";
  // default (including null/undefined/unknown) is dark — the brand default
  return "dark";
}

/**
 * Small inline script string that runs before hydration to set the `dark`
 * class on <html> based on the user's stored preference (cookie fallback)
 * and the current OS `prefers-color-scheme`. Needed only to avoid FOUC on
 * unauthenticated routes or when preference is `system` — authenticated
 * pages stamp the class server-side from the DB preference.
 *
 * The cookie is a best-effort echo of the DB preference; the server writes
 * it on every authenticated render so returning visitors on auth pages
 * don't flash dark.
 */
export const THEME_PRE_HYDRATION_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )ot_theme=([^;]+)/);var pref=m?m[1]:"dark";var osDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var dark=pref==="dark"||(pref==="system"&&osDark);var c=document.documentElement.classList;if(dark){c.add("dark");}else{c.remove("dark");}}catch(e){document.documentElement.classList.add("dark");}})();`;

export const THEME_COOKIE_NAME = "ot_theme";
