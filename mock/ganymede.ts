// Mock Ganymede server (port 4000) for exercising SERAPH locally. Also serves the built
// SERAPH UI at /tv/ so you can try the "running on Ganymede's origin" mode (Android shell).
//   bun run mock/ganymede.ts
import { join } from "path";

const DIST = join(import.meta.dir, "../web/build");
const MEDIA = join(import.meta.dir, "media/g");
const VIDEO = join(import.meta.dir, "media/video.webm");
const sessions = new Set<string>();
const authed = (req: Request) => sessions.has(/(?:^|; )session=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1] ?? "");
const progress: Record<string, { time: number; status: string }> = {};

const channels = [
  { id: "c1", ext_id: "1", name: "luna", display_name: "LunaPlays", image_path: "/data/videos/avatar.png" },
  { id: "c2", ext_id: "2", name: "ferro", display_name: "Ferrowave", image_path: "/data/videos/avatar.png" },
  { id: "c3", ext_id: "3", name: "kit", display_name: "KitCodes", image_path: "" },
];
const titles = [
  "Blind playthrough day 4 — the swamp level nobody warned me about",
  "Speedrun practice + viewer races",
  "Building a server rack from scratch (finally)",
  "Late night chill — chatting and ranked",
  "Patch 2.3 first look, new characters and banner pulls",
  "Co-op chaos with friends",
  "Reading your clips, then chess",
  "Marathon: 12 hours of retro games",
];
const videos = Array.from({ length: 40 }, (_, i) => {
  const ch = channels[i % 3];
  return {
    id: `v${i}`,
    ext_id: `${1000 + i}`,
    platform: "twitch",
    type: i % 7 === 3 ? "highlight" : i % 9 === 5 ? "clip" : "archive",
    title: `${titles[i % titles.length]}${i >= 8 ? ` (part ${Math.floor(i / 8) + 1})` : ""}`,
    duration: 180,
    views: 1200 + i * 37,
    resolution: "720p60",
    thumbnail_path: `/data/videos/thumb${(i % 6) + 1}.jpg`,
    web_thumbnail_path: `/data/videos/thumb${(i % 6) + 1}.jpg`,
    video_path: "/data/videos/video.webm",
    chat_path: "/data/videos/chat.json",
    status: "success",
    streamed_at: new Date(Date.now() - i * 86400000 * 0.7).toISOString(),
    created_at: new Date().toISOString(),
    edges: {
      channel: ch,
      chapters: [
        { id: `${i}-a`, start: 0, end: 60, title: "Just Chatting" },
        { id: `${i}-b`, start: 60, end: 130, title: "Hollow Knight" },
        { id: `${i}-c`, start: 130, end: 180, title: "Outro & raid" },
      ],
    },
  };
});

let tick = 0;
const T = (s: string) => s;
const queue: Record<string, any>[] = [
  { id: "q1", _status: "running", live_archive: true, on_hold: false, archive_chat: true, render_chat: false,
    task_vod_create_folder: "success", task_vod_download_thumbnail: "success", task_vod_save_info: "success",
    task_video_download: "running", task_video_convert: "pending", task_video_move: "pending",
    task_chat_download: "running", task_chat_convert: "pending", task_chat_render: "pending", task_chat_move: "pending",
    created_at: new Date(Date.now() - 3600_000).toISOString(), updated_at: new Date().toISOString(),
    edges: { vod: { ...videos[0], status: "running", title: "LIVE: late night chill — chatting and ranked" } } },
  { id: "q2", _status: "failed", live_archive: false, on_hold: false, archive_chat: true, render_chat: true,
    task_vod_create_folder: "success", task_vod_download_thumbnail: "success", task_vod_save_info: "success",
    task_video_download: "success", task_video_convert: "failed", task_video_move: "pending",
    task_chat_download: "success", task_chat_convert: "success", task_chat_render: "pending", task_chat_move: "pending",
    created_at: new Date(Date.now() - 7200_000).toISOString(), updated_at: new Date().toISOString(),
    edges: { vod: videos[4] } },
  { id: "q3", _status: "queued", live_archive: false, on_hold: true, archive_chat: false, render_chat: false,
    task_vod_create_folder: "pending", task_vod_download_thumbnail: "pending", task_vod_save_info: "pending",
    task_video_download: "pending", task_video_convert: "pending", task_video_move: "pending",
    created_at: new Date(Date.now() - 600_000).toISOString(), updated_at: new Date().toISOString(),
    edges: { vod: videos[7] } },
];
void T;

const words = ["pog", "lol", "KEKW", "that was insane", "chat is this real", "GG", "no way", "W streamer", "first time watching!", "the music slaps"];
const names = ["nightowl", "pixelpanda", "ArcadeAnna", "zeroCool", "mossy", "TidalWave", "bytewolf"];
function chatAt(vod: string, start: number, end: number) {
  const out = [];
  for (let t = Math.ceil(start * 2) / 2; t < end; t += 0.5) {
    const n = Math.round(t * 2);
    if (n % 3 === 0) continue;
    const name = names[n % names.length];
    const body = words[n % words.length];
    out.push({
      _id: `${vod}-${n}`,
      content_offset_seconds: t,
      commenter: { display_name: name, name, _id: name },
      message: {
        body,
        user_color: n % 4 === 0 ? "" : ["#ff7f50", "#5f9ea0", "#9acd32", "#da70d6"][n % 4],
        user_badges: n % 5 === 0 ? [{ _id: "subscriber", version: "0" }] : [],
        fragments: n % 6 === 1 ? [{ text: "Kappa", emoticon: { emoticon_id: "25" } }, { text: ` ${body} catJAM` }] : [{ text: body }],
        is_first_message: n === 7,
      },
    });
  }
  return out;
}

const ok = (data: unknown) => Response.json({ success: true, data, message: "" });
const fail = (status: number, message: string) => Response.json({ success: false, message }, { status });

async function serveFile(path: string, req: Request) {
  const file = Bun.file(path);
  if (!(await file.exists())) return new Response("not found", { status: 404 });
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)!;
    const size = file.size;
    const s = m[1] ? +m[1] : 0;
    const e = m[2] ? +m[2] : Math.min(size - 1, s + 4 * 1024 * 1024);
    return new Response(file.slice(s, e + 1), {
      status: 206,
      headers: { "Content-Range": `bytes ${s}-${e}/${size}`, "Accept-Ranges": "bytes", "Content-Type": file.type },
    });
  }
  return new Response(file, { headers: { "Accept-Ranges": "bytes" } });
}

function cors(req: Request, res: Response) {
  const origin = req.headers.get("origin");
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

Bun.serve({
  port: 4000,
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return cors(req, new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
        "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? "",
      } }));
    }
    return cors(req, await route(req));
  },
});

async function route(req: Request): Promise<Response> {
  {
    const url = new URL(req.url);
    const p = url.pathname;
    const q = url.searchParams;

    if (p === "/data/videos/video.webm") return serveFile(VIDEO, req);
    if (p.startsWith("/data/videos/")) return serveFile(join(MEDIA, p.slice(13)), req);
    if (p === "/tv" || p === "/tv/") return serveFile(join(DIST, "index.html"), req);
    if (p.startsWith("/tv/")) return serveFile(join(DIST, p.slice(4)), req);

    if (p === "/health") return new Response("OK", { headers: { "Access-Control-Allow-Origin": "*" } });
    if (p === "/api/v1/auth/me") return authed(req) ? ok({ id: "u1", username: "nicolas", role: "admin" }) : fail(401, "unauthorized");
    if (p === "/api/v1/auth/login" && req.method === "POST") {
      const b = await req.json();
      if (b.username === "nicolas" && b.password === "hunter2") {
        const sid = crypto.randomUUID();
        sessions.add(sid);
        const res = ok({ id: "u1", username: "nicolas", role: "admin" });
        res.headers.set("Set-Cookie", `session=${sid}; Path=/; HttpOnly; SameSite=Lax`); // same as Ganymede (scs)
        return res;
      }
      return fail(400, "invalid username or password");
    }
    if (p === "/api/v1/auth/logout") {
      return ok("");
    }
    if (p === "/api/v1/channel") return ok(channels);
    if (p === "/api/v1/playlist") return ok([{ id: "p1", name: "Best of 2026", description: "Favourite moments", thumbnail_path: "/data/videos/thumb3.jpg" }]);
    if (p === "/api/v1/vod/paginate" || p === "/api/v1/vod/search") {
      let list = videos.slice();
      if (q.get("channel_id")) list = list.filter((v) => v.edges.channel.id === q.get("channel_id"));
      if (q.get("types")) list = list.filter((v) => q.get("types")!.split(",").includes(v.type));
      if (q.get("playlist_id")) list = list.filter((_, i) => i % 4 === 0);
      if (q.get("q")) list = list.filter((v) => v.title.toLowerCase().includes(q.get("q")!.toLowerCase()));
      const limit = +q.get("limit")!, offset = +q.get("offset")!;
      return ok({ offset, limit, total_count: list.length, pages: Math.ceil(list.length / limit), data: list.slice(offset, offset + limit) });
    }
    let m;
    if ((m = /^\/api\/v1\/vod\/(v\d+)$/.exec(p))) return ok(videos.find((v) => v.id === m[1]));
    if ((m = /^\/api\/v1\/vod\/(v\d+)\/chat\/emotes$/.exec(p)))
      return ok([
        { id: "25", name: "Kappa", url: "/data/videos/emote.png", type: "twitch", source: "twitch", width: 28, height: 28 },
        { id: "x1", name: "catJAM", url: "/data/videos/emote.png", type: "third_party", source: "7tv", width: 28, height: 28 },
      ]);
    if ((m = /^\/api\/v1\/vod\/(v\d+)\/chat\/badges$/.exec(p)))
      return ok([{ version: "0", name: "subscriber", title: "Subscriber", image_url: "/data/videos/emote.png", image_url_1x: "/data/videos/emote.png" }]);
    if ((m = /^\/api\/v1\/vod\/(v\d+)\/chat\/seek$/.exec(p))) {
      const s = +q.get("start")!;
      return ok(chatAt(m[1], Math.max(0, s - 15), s).slice(-(+q.get("count")!)));
    }
    if ((m = /^\/api\/v1\/vod\/(v\d+)\/chat$/.exec(p))) return ok(chatAt(m[1], +q.get("start")!, +q.get("end")!));

    if (p === "/api/v1/queue" || p === "/api/v1/queue/task/start") {
      const bearer = req.headers.get("authorization") === "Bearer test-key";
      if (!authed(req) && !bearer) return fail(401, "unauthorized");
      if (p === "/api/v1/queue/task/start") {
        const b = await req.json();
        console.log("retry task", b);
        const item = queue.find((x) => x.id === b.queue_id);
        if (item) item[b.task_name] = "running";
        return ok(null);
      }
      // move the running item along so the screen visibly updates
      tick++;
      const live = queue[0];
      live.task_chat_download = tick % 2 ? "running" : "success";
      const want = (q.get("status") ?? "").split(",").filter(Boolean);
      const list = queue.filter((x) => !want.length || want.includes(x._status));
      return ok(list.map(({ _status, ...rest }) => rest));
    }
    if (p.startsWith("/api/v1/playback")) {
      if (!authed(req)) return fail(401, "unauthorized");
      if (p === "/api/v1/playback/start") return ok(null);
      if (p === "/api/v1/playback/progress" && req.method === "POST") {
        const b = await req.json();
        progress[b.vod_id] = { time: b.time, status: progress[b.vod_id]?.status ?? "in_progress" };
        console.log("progress", b);
        return ok(null);
      }
      if (p === "/api/v1/playback/status") {
        const b = await req.json();
        progress[b.vod_id] = { time: progress[b.vod_id]?.time ?? 0, status: b.status };
        console.log("status", b);
        return ok(null);
      }
      if (p === "/api/v1/playback/last")
        return ok({ data: Object.entries(progress).map(([id, pb]) => ({ playback: { vod_id: id, ...pb }, vod: videos.find((v) => v.id === id) })) });
      if (p === "/api/v1/playback") return ok(Object.entries(progress).map(([id, pb]) => ({ vod_id: id, ...pb })));
      if ((m = /^\/api\/v1\/playback\/(v\d+)$/.exec(p))) {
        if (req.method === "DELETE") {
          delete progress[m[1]];
          return ok(null);
        }
        return ok(progress[m[1]] ? { vod_id: m[1], ...progress[m[1]] } : null);
      }
    }
    return fail(404, `mock: no route ${p}`);
  }
}
console.log("mock ganymede on http://localhost:4000  (SERAPH UI also at /tv/; login nicolas / hunter2)");
