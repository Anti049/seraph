// Plex client: plex.tv (sign-in, server discovery) + Plex Media Server API.
//
// Every X-Plex-* value travels as a query parameter (the docs allow this), so GETs are
// CORS "simple requests": no preflight, which keeps things working from a Tizen widget
// (file:// origin) as well as the Android shell.

import { ReadCache } from "./cache";
import { platform } from "./platform";
import { getItem, setItem } from "./store";

export const PRODUCT = "SERAPH";
export const VERSION: string = __APP_VERSION__;
// `?plextv=<url>` points at a mock plex.tv for local testing (see mock/plex.ts).
const MOCK_TV = new URLSearchParams(location.search).get("plextv");
const PLEX_TV = MOCK_TV || "https://plex.tv";
const DISCOVER = MOCK_TV ? `${MOCK_TV}/discover` : "https://discover.provider.plex.tv";

// ---------- identity ----------

function clientId(): string {
  const KEY = "sp:clientId";
  let id = getItem(KEY);
  if (!id) {
    id = uuid();
    setItem(KEY, id);
  }
  return id;
}

export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const CLIENT_ID = clientId();

const deviceName =
  platform === "tizen" ? "Samsung TV" : platform === "androidtv" ? "Android TV" : "Browser";

/** X-Plex-* identification. "Chrome" makes the server use its browser playback profile (H.264/AAC HLS). */
function identity(token?: string): Record<string, string> {
  const p: Record<string, string> = {
    "X-Plex-Product": PRODUCT,
    "X-Plex-Version": VERSION,
    "X-Plex-Client-Identifier": CLIENT_ID,
    "X-Plex-Platform": "Chrome",
    "X-Plex-Device": deviceName,
    "X-Plex-Device-Name": `${PRODUCT} (${deviceName})`,
    "X-Plex-Model": "hosted",
  };
  if (token) p["X-Plex-Token"] = token;
  return p;
}

type Params = Record<string, string | number | boolean | undefined | null>;

function query(params: Params): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

export class PlexError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const reads = new ReadCache();
// Library browsing is cached; "/:/" endpoints (timeline, scrobble…) are writes even when they're GETs.
const cacheable = (method: string, url: string) => method === "GET" && /\/(library|hubs)\//.test(url) && !/\/:\//.test(url);

/** Forget cached library reads (after playback, marking watched, switching servers…). */
export const invalidatePlex = () => reads.clear();

function call<T>(method: string, url: string, timeoutMs = 15000): Promise<T> {
  if (cacheable(method, url)) return reads.get(url, () => fetchJSON<T>(method, url, timeoutMs));
  if (method !== "GET" || /\/:\//.test(url)) reads.clear();
  return fetchJSON<T>(method, url, timeoutMs);
}

async function fetchJSON<T>(method: string, url: string, timeoutMs: number): Promise<T> {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const t = setTimeout(() => ctl?.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { Accept: "application/json" }, signal: ctl?.signal });
  } catch (e) {
    throw new PlexError(0, (e as Error).name === "AbortError" ? "Timed out" : "Can't connect");
  } finally {
    clearTimeout(t);
  }
  if (res.status === 401) throw new PlexError(401, "Not authorized");
  if (!res.ok) throw new PlexError(res.status, `${res.status} ${res.statusText}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ---------- plex.tv ----------

export interface Pin {
  id: number;
  code: string;
  authToken: string | null;
  expiresIn?: number;
}

export interface PlexUser {
  id: number;
  uuid: string;
  username: string;
  title: string;
  thumb: string;
}

export interface Connection {
  uri: string;
  protocol: string;
  address: string;
  port: number;
  local: boolean;
  relay: boolean;
}

export interface Resource {
  name: string;
  clientIdentifier: string;
  provides: string;
  owned: boolean;
  accessToken: string;
  presence?: boolean;
  connections: Connection[];
}

/** Plex Discover watchlist (account-wide, works for any item with a plex:// guid). */
export const watchlist = {
  id: (m: Metadata) => (m.guid?.startsWith("plex://") ? m.guid.split("/").pop() : undefined),
  async has(token: string, m: Metadata): Promise<boolean> {
    const id = watchlist.id(m);
    if (!id) return false;
    const url = `${DISCOVER}/library/metadata/${id}/userState?${query(identity(token))}`;
    const r = await call<{ MediaContainer?: { UserState?: { watchlistedAt?: number } } }>("GET", url).catch(() => null);
    return !!r?.MediaContainer?.UserState?.watchlistedAt;
  },
  set(token: string, m: Metadata, on: boolean) {
    const id = watchlist.id(m);
    if (!id) return Promise.reject(new Error("This item isn't matched to Plex's catalogue"));
    return call("PUT", `${DISCOVER}/actions/${on ? "addToWatchlist" : "removeFromWatchlist"}?${query({ ratingKey: id, ...identity(token) })}`);
  },
};

export const plexTv = {
  /** 4-character code for https://plex.tv/link (strong=false). */
  createPin: () => call<Pin>("POST", `${PLEX_TV}/api/v2/pins?${query({ strong: "false", ...identity() })}`),
  checkPin: (id: number) => call<Pin>("GET", `${PLEX_TV}/api/v2/pins/${id}?${query(identity())}`),
  user: (token: string) => call<PlexUser>("GET", `${PLEX_TV}/api/v2/user?${query(identity(token))}`),
  resources: async (token: string) => {
    const all = await call<Resource[]>(
      "GET",
      `${PLEX_TV}/api/v2/resources?${query({ includeHttps: 1, includeRelay: 1, ...identity(token) })}`,
    );
    return (all ?? []).filter((r) => r.provides?.split(",").includes("server"));
  },
};

/**
 * Probe every connection of a server and return the best that answers:
 * local direct > remote direct > relay. Returns as soon as a local one responds.
 */
export async function pickConnection(res: Resource, timeoutMs = 6000): Promise<string> {
  const rank = (c: Connection) => (c.relay ? 2 : c.local ? 0 : 1);
  const conns = [...(res.connections ?? [])].sort((a, b) => rank(a) - rank(b));
  if (!conns.length) throw new PlexError(0, "Server has no connections");
  return new Promise((resolve, reject) => {
    const ok: Connection[] = [];
    let pending = conns.length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      ok.sort((a, b) => rank(a) - rank(b));
      if (ok.length) resolve(ok[0].uri);
      else reject(new PlexError(0, `Can't reach ${res.name}`));
    };
    const timer = setTimeout(finish, timeoutMs);
    for (const c of conns) {
      call("GET", `${c.uri}/identity?${query({ "X-Plex-Token": res.accessToken })}`, timeoutMs)
        .then(() => {
          ok.push(c);
          if (rank(c) === 0) {
            clearTimeout(timer);
            finish();
          }
        })
        .catch(() => {})
        .finally(() => {
          if (--pending === 0) {
            clearTimeout(timer);
            finish();
          }
        });
    }
  });
}

// ---------- Plex Media Server ----------

export interface Stream {
  id: number;
  streamType: 1 | 2 | 3; // video, audio, subtitle
  codec?: string;
  displayTitle?: string;
  extendedDisplayTitle?: string;
  language?: string;
  selected?: boolean;
  default?: boolean;
  forced?: boolean;
  /** present for external (sidecar) subtitle files: /library/streams/{id} */
  key?: string;
}

export interface Part {
  id: number;
  key: string;
  container?: string;
  duration?: number;
  indexes?: string;
  Stream?: Stream[];
}

export interface Media {
  id: number;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  videoProfile?: string;
  videoResolution?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  audioChannels?: number;
  Part: Part[];
}

export interface Marker {
  type: "intro" | "credits" | string;
  startTimeOffset: number;
  endTimeOffset: number;
  final?: boolean;
}

export interface Tag {
  tag: string;
}

export interface Metadata {
  /** Machine id of the server this item came from (added by SERAPH when it's fetched). */
  server?: string;
  ratingKey: string;
  guid?: string;
  librarySectionTitle?: string;
  librarySectionKey?: string;
  lastViewedAt?: number;
  key: string;
  type: "movie" | "show" | "season" | "episode" | "clip" | "collection" | string;
  title: string;
  titleSort?: string;
  grandparentTitle?: string;
  grandparentRatingKey?: string;
  grandparentThumb?: string;
  grandparentArt?: string;
  parentTitle?: string;
  parentRatingKey?: string;
  parentThumb?: string;
  parentIndex?: number;
  index?: number;
  year?: number;
  summary?: string;
  tagline?: string;
  studio?: string;
  contentRating?: string;
  rating?: number;
  audienceRating?: number;
  thumb?: string;
  art?: string;
  duration?: number; // ms
  viewOffset?: number; // ms
  viewCount?: number;
  leafCount?: number;
  viewedLeafCount?: number;
  childCount?: number;
  originallyAvailableAt?: string;
  addedAt?: number;
  librarySectionID?: number;
  Media?: Media[];
  Marker?: Marker[];
  Genre?: Tag[];
  Director?: Tag[];
  Role?: (Tag & { id?: number; role?: string; thumb?: string })[];
  Writer?: (Tag & { thumb?: string })[];
  Producer?: (Tag & { thumb?: string })[];
  Collection?: Tag[];
  OnDeck?: { Metadata?: Metadata[] };
}

export interface Hub {
  server?: string;
  title: string;
  hubIdentifier: string;
  type: string;
  key?: string;
  size?: number;
  more?: boolean;
  style?: string;
  Metadata?: Metadata[];
}

export interface Section {
  server?: string;
  key: string;
  title: string;
  type: "movie" | "show" | "artist" | "photo" | string;
  art?: string;
  thumb?: string;
}

interface Container<T = unknown> {
  MediaContainer: T & { size?: number; totalSize?: number; offset?: number };
}

export class PlexServer {
  constructor(
    public uri: string,
    public token: string,
    public name: string,
    public machineId: string,
    public local: boolean,
  ) {}

  url(path: string, params: Params = {}): string {
    const q = query({ ...params, ...identity(this.token) });
    return `${this.uri}${path}${path.includes("?") ? "&" : "?"}${q}`;
  }

  private get<T>(path: string, params: Params = {}) {
    return call<Container<T>>("GET", this.url(path, params)).then((r) => this.tag(r?.MediaContainer ?? ({} as T)));
  }

  /** Mark every item/hub/section in a response with this server, so it can be opened later. */
  private tag<T>(c: T): T {
    const id = this.machineId;
    const walk = (v: unknown, depth: number) => {
      if (!v || typeof v !== "object" || depth > 4) return;
      if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
      const o = v as Record<string, unknown>;
      if ("ratingKey" in o || "hubIdentifier" in o || ("key" in o && "type" in o && "title" in o)) o.server = id;
      for (const k of ["Metadata", "Hub", "Directory", "OnDeck"]) if (k in o) walk(o[k], depth + 1);
    };
    walk(c, 0);
    return c;
  }

  /** Library URI for adding this server's items to playlists. */
  itemUri(ratingKey: string) {
    return `server://${this.machineId}/com.plexapp.plugins.library/library/metadata/${ratingKey}`;
  }

  /** Resized artwork straight from the server's image transcoder. */
  image(path: string | undefined, width: number, height: number): string {
    if (!path) return "";
    return this.url("/photo/:/transcode", { width, height, minSize: 1, upscale: 1, url: path });
  }

  // library
  async hubs(): Promise<Hub[]> {
    const c = await this.get<{ Hub?: Hub[] }>("/hubs", { count: 16, includeEmpty: 0 });
    return c.Hub ?? [];
  }
  async continueWatching(): Promise<Metadata[]> {
    const c = await this.get<{ Hub?: Hub[]; Metadata?: Metadata[] }>("/hubs/continueWatching", { count: 20 });
    return c.Hub?.[0]?.Metadata ?? c.Metadata ?? [];
  }
  async sections(): Promise<Section[]> {
    const c = await this.get<{ Directory?: Section[] }>("/library/sections");
    return c.Directory ?? [];
  }
  async sectionHubs(key: string): Promise<Hub[]> {
    const c = await this.get<{ Hub?: Hub[] }>(`/hubs/sections/${key}`, { count: 16 });
    return c.Hub ?? [];
  }
  async sectionItems(key: string, start: number, size: number, sort = "addedAt:desc") {
    const c = await this.get<{ Metadata?: Metadata[] }>(`/library/sections/${key}/all`, {
      sort,
      "X-Plex-Container-Start": start,
      "X-Plex-Container-Size": size,
    });
    return { items: c.Metadata ?? [], total: c.totalSize ?? c.size ?? 0 };
  }
  /** Items in a library featuring a person (actor / director / writer). */
  async byPerson(sectionKey: string, by: "actor" | "director" | "writer", personId: string, start: number, size: number) {
    const c = await this.get<{ Metadata?: Metadata[] }>(`/library/sections/${sectionKey}/all`, {
      [by]: personId,
      sort: "originallyAvailableAt:desc",
      "X-Plex-Container-Start": start,
      "X-Plex-Container-Size": size,
    });
    return { items: c.Metadata ?? [], total: c.totalSize ?? c.size ?? 0 };
  }
  async metadata(ratingKey: string): Promise<Metadata | null> {
    const c = await this.get<{ Metadata?: Metadata[] }>(`/library/metadata/${ratingKey}`, {
      includeMarkers: 1,
      includeOnDeck: 1,
      includeChapters: 1,
    });
    return c.Metadata?.[0] ?? null;
  }
  async children(ratingKey: string): Promise<Metadata[]> {
    const c = await this.get<{ Metadata?: Metadata[] }>(`/library/metadata/${ratingKey}/children`);
    return c.Metadata ?? [];
  }
  async allLeaves(ratingKey: string): Promise<Metadata[]> {
    const c = await this.get<{ Metadata?: Metadata[] }>(`/library/metadata/${ratingKey}/allLeaves`);
    return c.Metadata ?? [];
  }
  async related(ratingKey: string): Promise<Hub[]> {
    const c = await this.get<{ Hub?: Hub[] }>(`/library/metadata/${ratingKey}/related`, { count: 16 }).catch(
      () => ({}) as { Hub?: Hub[] },
    );
    return c.Hub ?? [];
  }
  async search(q: string): Promise<Hub[]> {
    const c = await this.get<{ Hub?: Hub[] }>("/hubs/search", { query: q, limit: 24 });
    return (c.Hub ?? []).filter((h) => h.Metadata?.length && ["movie", "show", "episode", "season"].includes(h.type));
  }

  async hubItems(hubKey: string, count = 24): Promise<Metadata[]> {
    const c = await this.get<{ Metadata?: Metadata[] }>(hubKey, { count });
    return c.Metadata ?? [];
  }

  // lists
  async playlists(): Promise<Metadata[]> {
    const c = await this.get<{ Metadata?: Metadata[] }>("/playlists", { playlistType: "video" });
    return (c.Metadata ?? []).filter((p) => !(p as { smart?: boolean }).smart);
  }
  addToPlaylist(playlistRatingKey: string, ratingKey: string) {
    return call("PUT", this.url(`/playlists/${playlistRatingKey}/items`, { uri: this.itemUri(ratingKey) }));
  }
  async collections(sectionKey: string): Promise<Metadata[]> {
    const c = await this.get<{ Metadata?: Metadata[] }>(`/library/sections/${sectionKey}/collections`);
    return (c.Metadata ?? []).filter((p) => !(p as { smart?: string | boolean }).smart);
  }
  addToCollection(collectionRatingKey: string, ratingKey: string) {
    return call("PUT", this.url(`/library/collections/${collectionRatingKey}/items`, { uri: this.itemUri(ratingKey) }));
  }

  // manage (needs an owner/admin token)
  refresh(ratingKey: string) {
    return call("PUT", this.url(`/library/metadata/${ratingKey}/refresh`, { force: 1 }));
  }
  analyze(ratingKey: string) {
    return call("PUT", this.url(`/library/metadata/${ratingKey}/analyze`));
  }
  remove(ratingKey: string) {
    return call("DELETE", this.url(`/library/metadata/${ratingKey}`));
  }
  /** Plex Web page for an item (for the "open in web" QR code). */
  webUrl(ratingKey: string) {
    return `https://app.plex.tv/desktop/#!/server/${this.machineId}/details?key=${encodeURIComponent(`/library/metadata/${ratingKey}`)}`;
  }

  // watch state
  timeline(item: Metadata, state: "playing" | "paused" | "stopped" | "buffering", timeMs: number, durationMs: number) {
    return call(
      "GET",
      this.url("/:/timeline", {
        ratingKey: item.ratingKey,
        key: `/library/metadata/${item.ratingKey}`,
        identifier: "com.plexapp.plugins.library",
        state,
        time: Math.max(0, Math.floor(timeMs)),
        duration: Math.floor(durationMs),
        hasMDE: 1,
      }),
    ).catch(() => {});
  }
  scrobble(ratingKey: string) {
    return call("GET", this.url("/:/scrobble", { key: ratingKey, identifier: "com.plexapp.plugins.library" }));
  }
  unscrobble(ratingKey: string) {
    return call("GET", this.url("/:/unscrobble", { key: ratingKey, identifier: "com.plexapp.plugins.library" }));
  }
  selectStreams(partId: number, sel: { audioStreamID?: number; subtitleStreamID?: number }) {
    return call("PUT", this.url(`/library/parts/${partId}`, { ...sel, allParts: 1 }));
  }

  // playback
  directUrl(part: Part): string {
    return this.url(part.key);
  }
  transcodeParams(item: Metadata, opts: TranscodeOptions): Params {
    return {
      path: `/library/metadata/${item.ratingKey}`,
      mediaIndex: opts.mediaIndex ?? 0,
      partIndex: 0,
      protocol: "hls",
      fastSeek: 1,
      directPlay: 0,
      directStream: opts.forceVideoTranscode ? 0 : 1,
      directStreamAudio: 1,
      subtitleSize: 100,
      audioBoost: 100,
      subtitles: opts.subtitles ?? "burn",
      location: this.local ? "lan" : "wan",
      offset: Math.max(0, Math.floor(opts.offset ?? 0)),
      session: opts.session,
      "X-Plex-Session-Identifier": opts.session,
      maxVideoBitrate: opts.maxVideoBitrate,
      videoResolution: opts.videoResolution,
      videoQuality: 100,
      copyts: 1,
      mediaBufferSize: 102400,
      // When we draw subtitles ourselves, ask for text subtitles as WebVTT segments in the HLS stream.
      "X-Plex-Client-Profile-Extra":
        opts.subtitles === "segmented"
          ? "add-transcode-target(type=subtitleProfile&context=all&protocol=hls&container=webvtt&subtitleCodec=webvtt)"
          : undefined,
    };
  }
  /** Ask the server to prepare a transcode session (Plex clients do this before start). */
  decision(item: Metadata, opts: TranscodeOptions) {
    return call("GET", this.url("/video/:/transcode/universal/decision", this.transcodeParams(item, opts))).catch(() => null);
  }
  hlsUrl(item: Metadata, opts: TranscodeOptions): string {
    return this.url("/video/:/transcode/universal/start.m3u8", this.transcodeParams(item, opts));
  }
  stopTranscode(session: string) {
    return call("GET", this.url("/video/:/transcode/universal/stop", { session })).catch(() => {});
  }
  /** Preview frame for the scrubber, if the server generated "video preview thumbnails". */
  previewFrame(part: Part, timeMs: number): string | null {
    if (!part.indexes?.includes("sd")) return null;
    return this.url("/photo/:/transcode", {
      width: 320,
      height: 180,
      minSize: 1,
      upscale: 1,
      url: `/library/parts/${part.id}/indexes/sd/${Math.floor(timeMs)}`,
    });
  }
}

export interface TranscodeOptions {
  session: string;
  offset?: number;
  mediaIndex?: number;
  maxVideoBitrate?: number;
  videoResolution?: string;
  forceVideoTranscode?: boolean;
  subtitles?: "burn" | "segmented" | "none";
}

// ---------- helpers ----------

/** Can this TV's browser engine play the file as-is? */
export function canDirectPlay(media: Media, probe: HTMLVideoElement): boolean {
  const c = (media.container ?? "").toLowerCase();
  const v = (media.videoCodec ?? "").toLowerCase();
  const a = (media.audioCodec ?? "").toLowerCase();
  const vc: Record<string, string> = { h264: "avc1.640028", hevc: "hev1.1.6.L120.90", vp9: "vp09.00.40.08", vp8: "vp8", av1: "av01.0.08M.08" };
  const ac: Record<string, string> = { aac: "mp4a.40.2", mp3: "mp4a.40.34", ac3: "ac-3", eac3: "ec-3", opus: "opus", vorbis: "vorbis", flac: "flac" };
  const mime: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/mp4", webm: "video/webm", mkv: "video/x-matroska" };
  if (!mime[c] || !vc[v] || (a && !ac[a])) return false;
  const codecs = [vc[v], a ? ac[a] : null].filter(Boolean).join(", ");
  const answer = probe.canPlayType(`${mime[c]}; codecs="${codecs}"`);
  return answer === "probably" || answer === "maybe";
}

export function episodeLabel(m: Metadata): string {
  if (m.type !== "episode") return "";
  const s = m.parentIndex != null ? `S${m.parentIndex}` : "";
  const e = m.index != null ? `E${m.index}` : "";
  return `${s}${s && e ? " · " : ""}${e}`;
}

export function progressOf(m: Metadata): number {
  if (m.viewOffset && m.duration) return Math.min(1, m.viewOffset / m.duration);
  return 0;
}

export function isWatched(m: Metadata): boolean {
  if (m.type === "show" || m.type === "season") return !!m.leafCount && m.viewedLeafCount === m.leafCount;
  return (m.viewCount ?? 0) > 0 && !m.viewOffset;
}
