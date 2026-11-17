// What the app knows about where it's running, for Settings → About and error reports.
// Never includes tokens, account names or server addresses.
import { account } from "./account.svelte";
import { ganymede } from "./ganymede/source.svelte";
import { platform } from "./platform";

export const APP_VERSION: string = __APP_VERSION__;

export function nativeVersion(): string {
  try {
    return window.SeraphTV?.version?.() ?? "";
  } catch {
    return "";
  }
}

export function chromeVersion(): string {
  return /Chrom(?:e|ium)\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? "unknown";
}

export function diagnostics(): [string, string][] {
  const plex =
    account.phase === "ready" && account.server ? `connected (${account.server.local ? "local network" : "remote"})` : account.phase;
  const g = ganymede.phase === "off" ? "off" : `${ganymede.phase}, ${ganymede.mode} sync${ganymede.user ? "" : ", guest"}`;
  return [
    ["App", `SERAPH ${APP_VERSION}${nativeVersion() ? ` (shell ${nativeVersion()})` : ""}`],
    ["Platform", platform],
    ["Engine", `Chromium ${chromeVersion()}`],
    ["Screen", `${screen.width}×${screen.height} @${window.devicePixelRatio}x, viewport ${innerWidth}×${innerHeight}`],
    ["Plex", plex],
    ["Ganymede", g],
    ["Network", navigator.onLine ? "online" : "offline"],
  ];
}
