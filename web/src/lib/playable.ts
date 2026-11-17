// One player, two sources. Each adapter tells the player what to show and how to stream.
import { plex, account } from "./account.svelte";
import { canDirectPlay, episodeLabel, uuid, type Metadata, type Part } from "./plex";
import { QUALITIES, settings, type Quality } from "./settings.svelte";
import { isTextSubtitle } from "./subtitles";
import { api as gapi, media as gmedia, streamUrl as gStreamUrl, isLiveArchive, type Video } from "./ganymede/api";
import { ChatReplay, type ChatLine } from "./ganymede/chat";
import { ganymede } from "./ganymede/source.svelte";
import type { Route } from "./router.svelte";

export type Source = "plex" | "ganymede";

export interface Track {
  id: number;
  label: string;
  selected: boolean;
}

export interface Segment {
  type: "intro" | "credits" | string;
  start: number; // seconds
  end: number;
}

export interface Chapter {
  id: string;
  start: number;
  end: number;
  title: string;
}

export interface NextUp {
  label: string;
  title: string;
  thumb: string;
  route: Route;
}

/** A card in the row under the player controls. */
export interface Rec {
  key: string;
  title: string;
  sub: string;
  thumb: string;
  progress: number;
  route: Route;
}

/** The left-hand text block of the player. */
export interface PlayDetails {
  /** Show / channel name. */
  eyebrow: string;
  title: string;
  /** e.g. "S2 · E4", or the stream date */
  meta: string;
  description: string;
}

/** Subtitles the player draws itself (styled), instead of the server burning them in. */
export type TextSubs = { kind: "file"; url: string; codec?: string } | { kind: "track" };

export interface StreamInfo {
  url: string;
  hls: boolean;
  mode: "direct" | "transcode";
  subs?: TextSubs;
}

export interface Playable {
  source: Source;
  title: string;
  subtitle: string;
  poster: string;
  duration: number;
  markers: Segment[];
  chapters: Chapter[];
  audio: Track[];
  subtitles: Track[];
  supportsQuality: boolean;
  hasChat: boolean;
  /** Start (or restart) a stream. `at` is where playback should begin. */
  open(el: HTMLVideoElement, at: number, quality: Quality): Promise<StreamInfo>;
  close(): void;
  selectTrack(kind: "audio" | "subtitle", id: number | null): Promise<void>;
  report(state: "playing" | "paused" | "stopped", time: number, duration: number): void;
  finished(): void;
  next(): Promise<NextUp | null>;
  previewFrame(time: number): string | null;
  chat(onChange: (lines: ChatLine[]) => void): ChatReplay | null;
  /** Styled subtitles failed for this item: let the server burn them in from now on. */
  useBurnedSubtitles(): void;

  details: PlayDetails;
  previous(): Promise<NextUp | null>;
  recommended(): Promise<Rec[]>;
  /** Fixed facts about the file, for "stats for nerds". */
  fileInfo: [string, string][];
  /** Open the show / channel this belongs to. */
  parent?: { label: string; route: Route };
}

// ---------------------------------------------------------------- Plex
export async function plexPlayable(ratingKey: string, server?: string): Promise<Playable> {
  const s = plex(server);
  const item = await s.metadata(ratingKey);
  if (!item?.Media?.[0]?.Part?.[0]) throw new Error("This item has no playable file.");
  let part: Part = item.Media[0].Part[0];
  let session = uuid();
  let transcoding = false;
  let burnOnly = false;

  const tracks = (type: 2 | 3): Track[] =>
    (part.Stream ?? [])
      .filter((x) => x.streamType === type)
      .map((x) => ({ id: x.id, label: x.extendedDisplayTitle || x.displayTitle || x.language || `Track ${x.id}`, selected: !!x.selected }));

  const p: Playable = {
    source: "plex",
    title: (item.type === "episode" ? item.grandparentTitle : item.title) ?? "",
    subtitle: item.type === "episode" ? `${episodeLabel(item)} · ${item.title}` : item.year ? String(item.year) : "",
    poster: s.image(item.art || item.thumb, 1280, 720),
    duration: (item.duration ?? part.duration ?? 0) / 1000,
    markers: (item.Marker ?? []).map((m) => ({ type: m.type, start: m.startTimeOffset / 1000, end: m.endTimeOffset / 1000 })),
    chapters: [],
    get audio() {
      return tracks(2);
    },
    get subtitles() {
      return tracks(3);
    },
    supportsQuality: true,
    hasChat: false,

    async open(el, at, quality) {
      if (transcoding) s.stopTranscode(session);
      session = uuid();
      const q = QUALITIES.find((x) => x.id === quality)!;
      const sub = (part.Stream ?? []).find((x) => x.streamType === 3 && x.selected);
      // Text subtitles are drawn by the app with the user's style; image ones (PGS, VobSub) are burned in.
      const styled = !!sub && !burnOnly && settings.subRendering === "styled" && isTextSubtitle(sub.codec);
      const sidecar = styled && !!sub!.key;
      let subs: TextSubs | undefined;
      let subtitles: "burn" | "segmented" | "none" = "burn";
      if (sidecar) {
        subs = { kind: "file", url: s.url(sub!.key!), codec: sub!.codec };
        subtitles = "none";
      } else if (styled) {
        subs = { kind: "track" };
        subtitles = "segmented";
      }
      const canDirect = quality === "original" && (!sub || sidecar) && canDirectPlay(item.Media![0], el);
      if (canDirect) {
        transcoding = false;
        return { url: s.directUrl(part), hls: false, mode: "direct", subs };
      }
      const opts = { session, offset: 0, maxVideoBitrate: q.bitrate ?? 20000, videoResolution: q.resolution ?? "1920x1080", subtitles };
      await s.decision(item, opts);
      transcoding = true;
      return { url: s.hlsUrl(item, opts), hls: true, mode: "transcode", subs };
    },
    useBurnedSubtitles() {
      burnOnly = true;
    },
    close() {
      if (transcoding) s.stopTranscode(session);
      transcoding = false;
    },
    async selectTrack(kind, id) {
      await s.selectStreams(part.id, kind === "audio" ? { audioStreamID: id! } : { subtitleStreamID: id ?? 0 });
      const type = kind === "audio" ? 2 : 3;
      part = { ...part, Stream: (part.Stream ?? []).map((x) => (x.streamType === type ? { ...x, selected: x.id === id } : x)) };
    },
    report(state, time, duration) {
      s.timeline(item, state, time * 1000, duration * 1000);
    },
    finished() {
      s.scrobble(item.ratingKey).catch(() => {});
    },
    async next() {
      if (item.type !== "episode" || !item.grandparentRatingKey) return null;
      const all = await s.allLeaves(item.grandparentRatingKey).catch(() => [] as Metadata[]);
      const i = all.findIndex((e) => e.ratingKey === item.ratingKey);
      const n = i >= 0 ? all[i + 1] : undefined;
      if (!n) return null;
      const off = n.viewOffset && !n.viewCount ? n.viewOffset / 1000 : 0;
      return { label: episodeLabel(n), title: n.title, thumb: s.image(n.thumb, 400, 225), route: { name: "player", source: "plex", id: n.ratingKey, offset: off, server: s.machineId } };
    },
    previewFrame(time) {
      return s.previewFrame(part, time * 1000);
    },
    chat: () => null,

    details: {
      eyebrow: item.type === "episode" ? (item.grandparentTitle ?? "") : (item.librarySectionTitle ?? ""),
      title: item.title,
      meta: [item.type === "episode" ? episodeLabel(item) : item.year ? String(item.year) : "", item.contentRating].filter(Boolean).join(" · "),
      description: item.summary ?? "",
    },
    async previous() {
      if (item.type !== "episode" || !item.grandparentRatingKey) return null;
      const all = await s.allLeaves(item.grandparentRatingKey).catch(() => [] as Metadata[]);
      const i = all.findIndex((e) => e.ratingKey === item.ratingKey);
      const n = i > 0 ? all[i - 1] : undefined;
      if (!n) return null;
      return { label: episodeLabel(n), title: n.title, thumb: s.image(n.thumb, 400, 225), route: { name: "player", source: "plex", id: n.ratingKey, server: s.machineId } };
    },
    async recommended() {
      const card = (m: Metadata): Rec => ({
        key: m.ratingKey,
        title: m.type === "episode" ? m.title : m.title,
        sub: m.type === "episode" ? episodeLabel(m) : m.year ? String(m.year) : "",
        thumb: s.image(m.type === "episode" ? m.thumb : m.art || m.thumb, 400, 225),
        progress: m.viewOffset && m.duration ? m.viewOffset / m.duration : 0,
        route: { name: "player", source: "plex", id: m.ratingKey, server: s.machineId, offset: m.viewOffset && !m.viewCount ? m.viewOffset / 1000 : 0 },
      });
      if (item.type === "episode" && item.grandparentRatingKey) {
        // the rest of the show from here, then what came before
        const all = await s.allLeaves(item.grandparentRatingKey).catch(() => [] as Metadata[]);
        const i = all.findIndex((e) => e.ratingKey === item.ratingKey);
        return [...all.slice(i + 1), ...all.slice(0, Math.max(0, i))].slice(0, 16).map(card);
      }
      const hubs = await s.related(item.ratingKey);
      return hubs.flatMap((h) => h.Metadata ?? []).slice(0, 16).map(card);
    },
    get fileInfo(): [string, string][] {
      const m = item.Media![0];
      return [
        ["Container", (m.container ?? part.container ?? "").toUpperCase()],
        ["Video", [m.videoCodec?.toUpperCase(), m.videoProfile, m.width && m.height ? `${m.width}×${m.height}` : m.videoResolution].filter(Boolean).join(" · ")],
        ["Audio", [m.audioCodec?.toUpperCase(), m.audioChannels ? `${m.audioChannels} ch` : ""].filter(Boolean).join(" · ")],
        ["Bitrate", m.bitrate ? `${(m.bitrate / 1000).toFixed(1)} Mb/s` : ""],
        ["File", (part as Part & { file?: string }).file?.split(/[\\/]/).pop() ?? ""],
        ["Size", (part as Part & { size?: number }).size ? `${((part as Part & { size?: number }).size! / 1e9).toFixed(2)} GB` : ""],
        ["Server", s.name],
      ].filter(([, v]) => v) as [string, string][];
    },
    parent:
      item.type === "episode" && item.grandparentRatingKey
        ? { label: item.grandparentTitle ?? "Show", route: { name: "show", server: s.machineId, ratingKey: item.grandparentRatingKey, season: item.parentRatingKey } }
        : undefined,
  };
  return p;
}

export const defaultQuality = (server?: string): Quality => (account.connected.find((c) => c.machineId === server)?.local ?? account.server?.local ? "original" : "1080p-10");

// ---------------------------------------------------------------- Ganymede
export async function ganymedePlayable(id: string): Promise<Playable> {
  const v: Video = await gapi.video(id);
  gapi.startPlayback(id).catch(() => {});
  const chapters = (v.edges?.chapters ?? []).map((c) => ({ id: c.id, start: c.start, end: c.end, title: c.title || "Chapter" }));
  const date = new Date(v.streamed_at);
  const channel = v.edges?.channel;
  // The channel's videos, oldest first: previous/next follow the stream timeline.
  let timeline: Promise<Video[]> | null = null;
  const siblings = () =>
    (timeline ??= channel
      ? gapi
          .channelVideos(channel.id)
          .then((l) => (l ?? []).filter((x) => x.type === v.type).sort((a, b) => +new Date(a.streamed_at) - +new Date(b.streamed_at)))
          .catch(() => [] as Video[])
      : Promise.resolve([] as Video[]));
  const toNext = (x: Video): NextUp => ({
    label: new Date(x.streamed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    title: x.title,
    thumb: gmedia(x.web_thumbnail_path),
    route: { name: "player", source: "ganymede", id: x.id },
  });

  return {
    source: "ganymede",
    title: v.title,
    subtitle: [v.edges?.channel?.display_name, isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })]
      .filter(Boolean)
      .join(" · "),
    poster: gmedia(v.thumbnail_path),
    duration: v.duration || 0,
    markers: [],
    chapters,
    audio: [],
    subtitles: [],
    supportsQuality: false,
    hasChat: !!(v.chat_path || v.live_chat_path),
    async open() {
      const url = gStreamUrl(v);
      return { url, hls: url.endsWith(".m3u8") || isLiveArchive(v), mode: "direct" };
    },
    close() {},
    async selectTrack() {},
    report(state, time) {
      if (state !== "playing" && state !== "paused" && state !== "stopped") return;
      if (time > 5) ganymede.save(id, time);
    },
    finished() {
      ganymede.setStatus(id, "finished");
    },
    async next() {
      const all = await siblings();
      const i = all.findIndex((x) => x.id === id);
      return i >= 0 && all[i + 1] ? toNext(all[i + 1]) : null;
    },
    async previous() {
      const all = await siblings();
      const i = all.findIndex((x) => x.id === id);
      return i > 0 ? toNext(all[i - 1]) : null;
    },
    async recommended() {
      const all = await siblings();
      return all
        .filter((x) => x.id !== id)
        .reverse()
        .slice(0, 16)
        .map((x) => ({
          key: x.id,
          title: x.title,
          sub: new Date(x.streamed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
          thumb: gmedia(x.web_thumbnail_path),
          progress: ganymede.fraction(x.id, x.duration),
          route: { name: "player", source: "ganymede", id: x.id, offset: ganymede.progress[x.id]?.status === "finished" ? 0 : (ganymede.progress[x.id]?.time ?? 0) },
        }));
    },
    previewFrame() {
      return null;
    },
    chat(onChange) {
      return v.chat_path || v.live_chat_path ? new ChatReplay(id, onChange) : null;
    },
    useBurnedSubtitles() {},
    details: {
      eyebrow: channel?.display_name ?? "",
      title: v.title,
      meta: [isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), v.views ? `${v.views.toLocaleString()} views` : ""]
        .filter(Boolean)
        .join(" · "),
      description: "",
    },
    fileInfo: [
      ["Type", v.type],
      ["Resolution", v.resolution],
      ["File", v.video_path?.split("/").pop() ?? ""],
      ["Chat", v.chat_path || v.live_chat_path ? "available" : "none"],
    ].filter(([, x]) => x) as [string, string][],
    parent: channel ? { label: channel.display_name, route: { name: "g-channel", id: channel.id, title: channel.display_name } } : undefined,
  };
}

export function playableFor(source: Source, id: string, server?: string): Promise<Playable> {
  return source === "plex" ? plexPlayable(id, server) : ganymedePlayable(id);
}
