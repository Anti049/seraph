// Key/value storage that survives the Android shell switching origins.
// On Android, values live in the app's SharedPreferences (via the SeraphTV bridge), so the
// Plex token and settings are kept when the UI moves to the Ganymede origin and back.
// Everywhere else it's plain localStorage.

//
// Profiles: every key belongs to the active profile unless it's listed in GLOBAL. The first
// profile ("main") uses the plain keys, so installs from before profiles existed keep their data;
// other profiles get "sp:p:<id>:" prefixes.

type Bridge = { getItem?(k: string): string | null; setItem?(k: string, v: string): void; removeItem?(k: string): void };
const bridge = (): Bridge | undefined => (window as unknown as { SeraphTV?: Bridge }).SeraphTV;

/** Keys shared by every profile on this TV. */
const GLOBAL = new Set(["sp:profiles", "sp:profile", "sp:update", "sp:report:repo", "sp:report:log"]);
export const MAIN_PROFILE = "main";

function rawGet(k: string): string | null {
  try {
    const b = bridge();
    if (b?.getItem) return b.getItem(k) ?? null;
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** Active profile id, read once at startup (switching profiles reloads the app). */
export const activeProfile: string = rawGet("sp:profile") || MAIN_PROFILE;

function scoped(k: string): string {
  if (activeProfile === MAIN_PROFILE || GLOBAL.has(k) || !k.startsWith("sp:")) return k;
  return `sp:p:${activeProfile}:${k.slice(3)}`;
}

export function getItem(k: string): string | null {
  return rawGet(scoped(k));
}

export function setItem(k: string, v: string | null) {
  k = scoped(k);
  try {
    const b = bridge();
    if (b?.setItem && b.removeItem) {
      if (v === null) b.removeItem(k);
      else b.setItem(k, v);
      return;
    }
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
}

export function getJSON<T>(k: string, fallback: T): T {
  const raw = getItem(k);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const setJSON = (k: string, v: unknown) => setItem(k, v === null ? null : JSON.stringify(v));
