// App navigation on top of SvelteKit's hash router.
//
// Every screen has a real URL (#/plex/item/123, #/play/ganymede/abc?t=90…), and the TV Back key
// walks browser history. Each history entry carries its depth in SvelteKit's page state, and the
// router keeps a parallel stack of {path, focusId} so focus lands back on the card you came from.
import { goto, afterNavigate } from "$app/navigation";
import { page } from "$app/state";

export type Route =
  | { name: "home" }
  | { name: "library"; server: string; key: string; title: string; type: string }
  | { name: "libraries" }
  | { name: "search" }
  | { name: "details"; server: string; ratingKey: string }
  | { name: "show"; server: string; ratingKey: string; season?: string }
  | { name: "person"; server: string; id: string; section: string; by: "actor" | "director" | "writer"; title: string }
  | { name: "player"; source: "plex" | "ganymede"; id: string; offset?: number; server?: string }
  | { name: "g-channels" }
  | { name: "g-channel"; id: string; title: string }
  | { name: "g-playlists" }
  | { name: "g-playlist"; id: string; title: string }
  | { name: "g-video"; id: string }
  | { name: "g-queue" }
  | { name: "settings"; section?: SettingsSection }
  // full-screen setup flow (the (setup) route group)
  | { name: "starting" }
  | { name: "welcome" }
  | { name: "profiles" }
  | { name: "profile-new" }
  | { name: "plex-signin" }
  | { name: "plex-servers" }
  | { name: "g-setup" }
  | { name: "g-scan" }
  | { name: "g-signin" };

export const SETTINGS_SECTIONS = [
  "profiles", "plex", "libraries", "ganymede", "quality", "playback", "captions", "interface", "chat", "reports", "updates", "about",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const SETUP_PATHS = {
  starting: "/starting",
  welcome: "/welcome",
  profiles: "/profiles",
  "profile-new": "/profiles/new",
  "plex-signin": "/setup/plex",
  "plex-servers": "/setup/plex/servers",
  "g-setup": "/setup/ganymede",
  "g-scan": "/setup/ganymede/scan",
  "g-signin": "/setup/ganymede/sign-in",
} as const;
export type SetupName = keyof typeof SETUP_PATHS;
/** A setup screen as a Route. */
export const setupRoute = (name: SetupName) => ({ name }) as Route;

declare global {
  namespace App {
    interface PageState {
      depth?: number;
    }
  }
}

const enc = encodeURIComponent;
const qs = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${enc(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

/** Route → app path (without the leading "#"). */
export function pathOf(r: Route): string {
  switch (r.name) {
    case "home":
      return "/";
    case "library":
      return `/plex/${enc(r.server)}/library/${enc(r.key)}${qs({ title: r.title, type: r.type })}`;
    case "libraries":
      return "/plex/libraries";
    case "search":
      return "/search";
    case "details":
      return `/plex/${enc(r.server)}/item/${enc(r.ratingKey)}`;
    case "show":
      return `/plex/${enc(r.server)}/show/${enc(r.ratingKey)}${qs({ season: r.season })}`;
    case "person":
      return `/plex/${enc(r.server)}/person/${enc(r.id)}${qs({ section: r.section, by: r.by, title: r.title })}`;
    case "player":
      return `/play/${r.source}/${enc(r.id)}${qs({ s: r.server, t: r.offset ? Math.round(r.offset) : undefined })}`;
    case "g-channels":
      return "/ganymede/channels";
    case "g-channel":
      return `/ganymede/channel/${enc(r.id)}${qs({ title: r.title })}`;
    case "g-playlists":
      return "/ganymede/playlists";
    case "g-playlist":
      return `/ganymede/playlist/${enc(r.id)}${qs({ title: r.title })}`;
    case "g-video":
      return `/ganymede/video/${enc(r.id)}`;
    case "g-queue":
      return "/ganymede/queue";
    case "settings":
      return `/settings/${r.section ?? "profiles"}`;
    default:
      return SETUP_PATHS[r.name];
  }
}

/** App path → Route (unknown paths fall back to home). */
export function parse(path: string): Route {
  const [p, search = ""] = path.split("?");
  const q = new URLSearchParams(search);
  const seg = p.split("/").filter(Boolean).map(decodeURIComponent);
  const get = (k: string) => q.get(k) ?? "";
  if (seg[0] === "plex" && seg.length === 4) {
    const [, server, kind, id] = seg;
    if (kind === "library") return { name: "library", server, key: id, title: get("title"), type: get("type") };
    if (kind === "item") return { name: "details", server, ratingKey: id };
    if (kind === "show") return { name: "show", server, ratingKey: id, season: q.get("season") ?? undefined };
    if (kind === "person")
      return { name: "person", server, id, section: get("section"), by: (get("by") || "actor") as "actor" | "director" | "writer", title: get("title") };
  }
  switch (seg.join("/").replace(/\/[^/]+$/, "/:id")) {
    case "ganymede/channel/:id":
      return { name: "g-channel", id: seg[2], title: get("title") };
    case "ganymede/playlist/:id":
      return { name: "g-playlist", id: seg[2], title: get("title") };
    case "ganymede/video/:id":
      return { name: "g-video", id: seg[2] };
  }
  if (seg[0] === "play" && seg.length === 3 && (seg[1] === "plex" || seg[1] === "ganymede")) {
    const t = Number(q.get("t"));
    return { name: "player", source: seg[1], id: seg[2], offset: t > 0 ? t : undefined, server: q.get("s") ?? undefined };
  }
  if (seg[0] === "settings") {
    const section = SETTINGS_SECTIONS.find((x) => x === seg[1]);
    return { name: "settings", section: section ?? "profiles" };
  }
  const setup = (Object.keys(SETUP_PATHS) as SetupName[]).find((k) => SETUP_PATHS[k] === p.replace(/\/$/, ""));
  if (setup) return { name: setup };
  switch (seg.join("/")) {
    case "plex/libraries":
      return { name: "libraries" };
    case "search":
      return { name: "search" };
    case "ganymede/channels":
      return { name: "g-channels" };
    case "ganymede/playlists":
      return { name: "g-playlists" };
    case "ganymede/queue":
      return { name: "g-queue" };
  }
  return { name: "home" };
}

const currentPath = () => decodeURI(location.hash.replace(/^#/, "")) || "/";

interface Entry {
  path: string;
  route: Route;
  key: number;
  focusId?: string;
}

let seq = 0;

class Router {
  stack = $state<Entry[]>([{ path: "/", route: { name: "home" }, key: seq++ }]);
  /** True when the last navigation came from Back (focus should be restored, not reset). */
  restoring = $state(false);
  #pendingRoot: { path: string; keepFocus: boolean } | null = null;

  get current(): Entry {
    return this.stack[this.stack.length - 1];
  }

  get depth() {
    return this.stack.length - 1;
  }

  /** Call once from the root layout. */
  install() {
    const path = currentPath();
    this.stack = [{ path, route: parse(path), key: seq++ }];
    afterNavigate((nav) => {
      const path = currentPath();
      const depth = page.state.depth ?? 0;
      if (this.#pendingRoot !== null && depth === 0) {
        const { path: target, keepFocus } = this.#pendingRoot;
        this.#pendingRoot = null;
        if (target !== path) {
          void goto(`#${target}`, { replaceState: true, state: { depth: 0 }, reset: !keepFocus });
          return;
        }
      }
      const prev = this.stack[depth];
      const same = prev && prev.path === path;
      const next = this.stack.slice(0, depth);
      next.push(same ? prev : { path, route: parse(path), key: seq++ });
      this.restoring = nav.type === "popstate" && !!same;
      this.stack = next;
    });
  }

  #rememberFocus() {
    const el = document.activeElement as HTMLElement | null;
    this.current.focusId = el?.dataset?.focusId;
  }

  push(route: Route) {
    this.#rememberFocus();
    void goto(`#${pathOf(route)}`, { state: { depth: this.depth + 1 } });
  }

  replace(route: Route) {
    void goto(`#${pathOf(route)}`, { replaceState: true, state: { depth: this.depth } });
  }

  /** Jump to a top-level screen, dropping the history above it. `keepFocus` leaves the focused
   *  element alone instead of letting SvelteKit reset it (the side rail navigating as you move). */
  root(route: Route, opts: { keepFocus?: boolean } = {}) {
    this.rootPath(pathOf(route), opts);
  }

  /** Like root(), for a raw app path (e.g. a deep link saved while setup was showing). */
  rootPath(target: string, { keepFocus = false }: { keepFocus?: boolean } = {}) {
    if (this.depth > 0) {
      this.#pendingRoot = { path: target, keepFocus };
      history.go(-this.depth);
    } else if (target !== this.current.path) {
      void goto(`#${target}`, { replaceState: true, state: { depth: 0 }, reset: !keepFocus });
    }
  }

  /** Go back to an earlier depth (e.g. leaving a multi-step flow in one go). */
  backTo(depth: number) {
    if (depth < this.depth) history.go(depth - this.depth);
  }

  back(): boolean {
    if (this.depth === 0) return false;
    history.back();
    return true;
  }
}

export const router = new Router();

/** Query parameters of the current screen (they live inside the hash). */
export function routeQuery(): URLSearchParams {
  const hash = location.hash.replace(/^#/, "");
  const i = hash.indexOf("?");
  return new URLSearchParams(i >= 0 ? hash.slice(i + 1) : "");
}
