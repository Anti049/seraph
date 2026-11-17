// Thin client for the Ganymede v1 API. Requests carry the Ganymede session cookie
// (credentials: "include"). The base URL comes from the configured Ganymede source.
import { ReadCache } from "../cache";
import { gBase, gApiKey } from "./base";

export interface Channel {
  id: string;
  ext_id: string;
  name: string;
  display_name: string;
  image_path: string;
}

export interface Chapter {
  id: string;
  start: number;
  end: number;
  type?: string;
  title?: string;
}

/** Current Ganymede: queued/running/finalizing/completed/failed. Older releases: waiting/pending/archiving/success/error. */
export type ArchiveStatus = "queued" | "running" | "finalizing" | "completed" | "failed" | string;

const ACTIVE = ["queued", "running", "finalizing", "waiting", "pending", "archiving"];
export const isRecording = (status: string) => ACTIVE.includes(status);

export interface Video {
  id: string;
  ext_id: string;
  ext_stream_id?: string;
  platform: string;
  type: "archive" | "clip" | "live" | "highlight" | "upload" | string;
  title: string;
  duration: number;
  views: number;
  local_views?: number;
  resolution: string;
  thumbnail_path: string;
  web_thumbnail_path: string;
  video_path: string;
  chat_path?: string;
  live_chat_path?: string;
  tmp_video_hls_path?: string;
  status: ArchiveStatus;
  streamed_at: string;
  created_at: string;
  caption_path?: string;
  locked?: boolean;
  file_name?: string;
  edges?: { channel?: Channel; chapters?: Chapter[] };
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  thumbnail_path: string;
}

export interface Playback {
  id: string;
  vod_id: string;
  time: number;
  status: "in_progress" | "finished";
  updated_at: string;
}

export interface User {
  id: string;
  username: string;
  role: string;
}

export interface Page<T> {
  offset: number;
  limit: number;
  total_count: number;
  pages: number;
  data: T[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined>;

function qs(params?: Query): string {
  if (!params) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

const reads = new ReadCache();
const CACHED = /^\/(channel|playlist|vod)(\/|$)/;

function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; apiKey?: boolean } = {}): Promise<T> {
  if (method === "GET" && CACHED.test(path)) return reads.get(`${gBase()}${path}${qs(opts.query)}`, () => send<T>(method, path, opts));
  if (method !== "GET") reads.clear();
  return send<T>(method, path, opts);
}

/** Forget cached reads (e.g. after switching servers). */
export const invalidateGanymede = () => reads.clear();

async function send<T>(method: string, path: string, opts: { query?: Query; body?: unknown; apiKey?: boolean }): Promise<T> {
  let res: Response;
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  // Queue endpoints accept an API key, which works even where the login cookie doesn't (Samsung).
  const key = opts.apiKey ? gApiKey() : "";
  if (key) headers.Authorization = `Bearer ${key}`;
  try {
    res = await fetch(`${gBase()}/api/v1${path}${qs(opts.query)}`, {
      method,
      credentials: "include",
      headers: Object.keys(headers).length ? headers : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach Ganymede");
  }
  let json: { success?: boolean; data?: T; message?: string } | null = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new ApiError(res.status, json?.message || `${res.status} ${res.statusText}`);
  return (json?.data ?? null) as T;
}

/** Media paths from the API are server-relative (e.g. /data/videos/...): make them absolute. */
export function media(path?: string | null): string {
  if (!path) return "";
  if (/^https?:/.test(path) || path.startsWith("data:")) return path;
  return gBase() + path.replace(/#/g, "%23");
}

export const api = {
  me: () => request<User>("GET", "/auth/me"),
  login: (username: string, password: string) => request<User>("POST", "/auth/login", { body: { username, password } }),
  logout: () => request<unknown>("POST", "/auth/logout"),

  channels: () => request<Channel[]>("GET", "/channel"),
  playlists: () => request<Playlist[]>("GET", "/playlist"),
  playlist: (id: string) => request<Playlist>("GET", `/playlist/${id}`),

  video: (id: string) =>
    request<Video>("GET", `/vod/${id}`, { query: { with_channel: true, with_chapters: true } }),

  videos: (q: {
    limit: number;
    offset: number;
    channel_id?: string;
    playlist_id?: string;
    types?: string;
    sort_by?: "date" | "views" | "local_views" | "created";
    order?: "asc" | "desc";
  }) => request<Page<Video>>("GET", "/vod/paginate", { query: q }),

  /** Every video of a channel (newest first, no paging). */
  channelVideos: (channel_id: string) => request<Video[] | null>("GET", "/vod", { query: { channel_id } }),
  /** A video's chapters (used to tell which games were played). */
  chapters: (id: string) => request<Video>("GET", `/vod/${id}`, { query: { with_chapters: true } }).then((v) => v.edges?.chapters ?? []),

  // Lists and management (editor role, or admin for delete; or an API key with those scopes)
  addToPlaylist: (playlistId: string, vod_id: string) =>
    request<unknown>("POST", `/playlist/${playlistId}`, { body: { vod_id }, apiKey: true }),
  lock: (id: string, locked: boolean) => request<unknown>("POST", `/vod/${id}/lock`, { query: { locked }, apiKey: true }),
  remove: (id: string, deleteFiles: boolean) =>
    request<unknown>("DELETE", `/vod/${id}`, { query: { delete_files: deleteFiles }, apiKey: true }),
  regenerateThumbnails: (id: string) => request<unknown>("POST", `/vod/${id}/generate-sprite-thumbnails`, { apiKey: true }),
  /** ffprobe output for the video file (archiver role or API key). */
  probe: (id: string) => request<FFprobe>("POST", `/vod/${id}/ffprobe`, { apiKey: true }),

  search: (q: string, limit: number, offset: number) =>
    request<Page<Video>>("GET", "/vod/search", { query: { q, limit, offset } }),

  // Playback progress (requires a logged-in session)
  lastPlaybacks: (limit = 20) =>
    request<{ data: { playback: Playback; vod: Video }[] | null }>("GET", "/playback/last", { query: { limit } }),
  allProgress: () => request<Playback[] | null>("GET", "/playback"),
  progress: (id: string) => request<Playback | null>("GET", `/playback/${id}`),
  saveProgress: (vod_id: string, time: number) =>
    request<unknown>("POST", "/playback/progress", { body: { vod_id, time: Math.max(1, Math.floor(time)) } }),
  setStatus: (vod_id: string, status: "in_progress" | "finished") =>
    request<unknown>("POST", "/playback/status", { body: { vod_id, status } }),
  clearProgress: (id: string) => request<unknown>("DELETE", `/playback/${id}`),
  startPlayback: (id: string) => request<unknown>("POST", "/playback/start", { query: { video_id: id } }),

  // Archive queue (needs the archiver role or an API key with queue:read; retry needs queue:write)
  queue: (statuses = "queued,running,finalizing,failed") =>
    request<QueueItem[] | null>("GET", "/queue", { query: { status: statuses }, apiKey: true }),
  retryTask: (queue_id: string, task_name: string) =>
    request<unknown>("POST", "/queue/task/start", { body: { queue_id, task_name, continue: true }, apiKey: true }),

  // Chat
  chatEmotes: (id: string) => request<ChatEmote[] | null>("GET", `/vod/${id}/chat/emotes`),
  chatBadges: (id: string) => request<ChatBadge[] | null>("GET", `/vod/${id}/chat/badges`),
  chatRange: (id: string, start: number, end: number) =>
    request<ChatComment[] | null>("GET", `/vod/${id}/chat`, { query: { start, end } }),
  chatSeek: (id: string, start: number, count: number) =>
    request<ChatComment[] | null>("GET", `/vod/${id}/chat/seek`, { query: { start, count } }),
};

export interface FFprobe {
  format?: { filename?: string; format_long_name?: string; duration?: string; size?: string; bit_rate?: string };
  streams?: { codec_type?: string; codec_name?: string; profile?: string; width?: number; height?: number; r_frame_rate?: string; bit_rate?: string; channels?: number; sample_rate?: string }[];
}

export type TaskStatus = "success" | "running" | "pending" | "failed" | string;

export const QUEUE_TASKS: { key: string; label: string; chat?: boolean; live?: boolean }[] = [
  { key: "task_vod_create_folder", label: "Create folder" },
  { key: "task_vod_download_thumbnail", label: "Thumbnail" },
  { key: "task_vod_save_info", label: "Save info" },
  { key: "task_video_download", label: "Download video" },
  { key: "task_video_convert", label: "Convert video" },
  { key: "task_video_move", label: "Move video" },
  { key: "task_chat_download", label: "Download chat", chat: true },
  { key: "task_chat_convert", label: "Convert chat", chat: true },
  { key: "task_chat_render", label: "Render chat", chat: true },
  { key: "task_chat_move", label: "Move chat", chat: true },
];

export interface QueueItem {
  id: string;
  live_archive: boolean;
  on_hold: boolean;
  archive_chat: boolean;
  render_chat: boolean;
  created_at: string;
  updated_at: string;
  edges?: { vod?: Video };
  [task: string]: unknown;
}

export interface ChatEmote {
  id: string;
  name: string;
  url: string;
  type: string;
  source: string;
  width: number;
  height: number;
}

export interface ChatBadge {
  version: string;
  name: string;
  title: string;
  image_url: string;
  image_url_1x: string;
  image_url_2x: string;
}

export interface ChatComment {
  _id: string;
  content_offset_seconds: number;
  commenter: { display_name: string; name: string; _id: string };
  message: {
    body: string;
    bits_spent?: number;
    is_action?: boolean;
    is_first_message?: boolean;
    user_color?: string;
    user_badges?: { _id: string; version: string }[] | null;
    fragments?: { text: string; emoticon?: { emoticon_id: string } | null }[] | null;
    user_notice_params?: { msg_id?: string } | null;
  };
}

export function isLiveArchive(v: Video): boolean {
  return isRecording(v.status) || v.video_path?.endsWith(".m3u8");
}

export function streamUrl(v: Video): string {
  if (isRecording(v.status) && v.tmp_video_hls_path) {
    return `${media(v.tmp_video_hls_path)}/${v.ext_stream_id || v.ext_id}-video.m3u8`;
  }
  return media(v.video_path);
}
