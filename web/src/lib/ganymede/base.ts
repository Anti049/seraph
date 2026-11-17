import { getItem, setItem } from "../store";

const KEY = "sp:ganymede:url";

/** Offered on the setup screen as "Use default". Override at build time with GANYMEDE_DEFAULT. */
export const DEFAULT_GANYMEDE: string = __GANYMEDE_DEFAULT__;

/** Configured Ganymede server URL, e.g. https://ganymede.nploetz.dev ("" when not set up). */
export function gUrl(): string {
  return (getItem(KEY) ?? "").replace(/\/+$/, "");
}

export function setGUrl(url: string | null) {
  setItem(KEY, url);
}

/** Request prefix: empty when the app is running on Ganymede's own origin (Android shell). */
export function gBase(): string {
  const url = gUrl();
  return url && url === location.origin ? "" : url;
}

/** True when the UI is served from the Ganymede origin, so its login cookie is first-party. */
export const onGanymedeOrigin = () => !!gUrl() && gUrl() === location.origin;

const KEY_API = "sp:ganymede:apiKey";

/** Optional Ganymede API key (Admin → API keys) used for the queue; "" when unset. */
export const gApiKey = () => getItem(KEY_API) ?? "";
export const setGApiKey = (key: string | null) => setItem(KEY_API, key && key.trim() ? key.trim() : null);
