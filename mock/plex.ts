// Mock plex.tv (port 4100) + Plex Media Server (port 32400) for exercising SERAPH locally.
//   bun run mock/plex.ts
//   open http://localhost:4100/?plextv=http://localhost:4100      (serves web/build too)
// The link code is accepted automatically after ~4 seconds.
import { join } from "path";

const DIST = join(import.meta.dir, "../web/build");
const MEDIA = join(import.meta.dir, "media");
const DURATION = 180_000; // ms; every item uses the same 3-minute test video

// ---------- library ----------
type Item = Record<string, any>;
type St = { viewOffset: number; viewCount: number; updated: number };

function mediaFor(id: string) {
  const partId = Number(id) * 10;
  return [
    {
      id: partId,
      container: "webm",
      videoCodec: "vp8",
      audioCodec: "opus",
      videoResolution: "720",
      width: 1280,
      height: 720,
      audioChannels: 2,
      bitrate: 2400,
      Part: [
        {
          id: partId,
          key: `/library/parts/${partId}/1700000000/file.webm`,
          file: `/media/movies/${id}/file.webm`,
          size: 54_000_000,
          container: "webm",
          duration: DURATION,
          indexes: "sd",
          Stream: [
            { id: partId + 1, streamType: 1, codec: "vp8", displayTitle: "720p (VP8)" },
            { id: partId + 2, streamType: 2, codec: "opus", displayTitle: "English (OPUS Stereo)", language: "English", selected: true },
            { id: partId + 3, streamType: 2, codec: "opus", displayTitle: "日本語 (OPUS Stereo)", language: "Japanese" },
            { id: partId + 4, streamType: 3, codec: "srt", displayTitle: "English (SRT External)", language: "English", key: `/library/streams/${partId + 4}` },
            { id: partId + 6, streamType: 3, codec: "ass", displayTitle: "English Signs (ASS)", language: "English" },
            { id: partId + 5, streamType: 3, codec: "pgs", displayTitle: "Español (PGS)", language: "Spanish" },
          ],
        },
      ],
    },
  ];
}

const PEOPLE = ["Sam Rivera", "Jo Lin", "Ade Okafor", "Mira Haas", "Tomás Vidal", "Priya Nair"];
const person = (i: number, role?: string) => ({ id: 9000 + i, tag: PEOPLE[i], role, thumb: `http://localhost:4100/img/poster${(i % 8) + 1}` });

interface Lib {
  name: string;
  items: Map<string, Item>;
  state: Map<string, St>;
  sections: { key: string; title: string; type: string }[];
  playlists: { ratingKey: string; title: string; items: string[] }[];
  collections: { ratingKey: string; title: string; section: string; items: string[] }[];
}

function buildLibrary(name: string, movieTitles: string[], shows: { title: string; seasons: number }[], sections: Lib["sections"]): Lib {
  const items = new Map<string, Item>();
  let nextId = 100;
  movieTitles.forEach((title, i) => {
    const id = String(nextId++);
    items.set(id, {
      ratingKey: id, key: `/library/metadata/${id}`, guid: `plex://movie/m${name.length}${id}`, type: "movie", title, year: 2010 + (i % 15),
      summary: "A quietly ambitious story about people, places and the small moments in between. Placeholder synopsis for the mock server.",
      tagline: i % 3 === 0 ? "Some journeys begin at home." : undefined,
      contentRating: ["PG", "PG-13", "R"][i % 3], audienceRating: 6 + (i % 4) * 0.7, duration: DURATION,
      thumb: `/img/poster${(i % 8) + 1}`, art: `/img/art${(i % 8) + 1}`, librarySectionID: 1, librarySectionKey: "/library/sections/1",
      librarySectionTitle: sections[0].title, addedAt: 1_760_000_000 - i * 86400,
      Genre: [{ tag: ["Drama", "Sci-Fi", "Comedy", "Thriller"][i % 4] }],
      Director: [{ ...person(5), role: undefined }], Writer: [{ ...person(4), role: undefined }],
      Role: [person(i % 3, "Captain Hale"), person((i + 1) % 3, "Dr. Wren"), person(3, "Narrator")],
      Marker: [{ type: "credits", startTimeOffset: 165_000, endTimeOffset: 180_000, final: true }],
      Media: mediaFor(id),
    });
  });
  shows.forEach((sh, si) => {
    const showId = String(nextId++);
    items.set(showId, {
      ratingKey: showId, key: `/library/metadata/${showId}/children`, guid: `plex://show/s${showId}`, type: "show", title: sh.title, year: 2021 + si,
      summary: "An ensemble series from the mock server, with two kinds of markers to try Skip intro and Up next.",
      contentRating: "TV-14", thumb: `/img/poster${si + 3}`, art: `/img/art${si + 5}`, librarySectionID: 2, childCount: sh.seasons,
      librarySectionTitle: "TV Shows", studio: "Mock Studios", addedAt: 1_760_000_000 - si * 3600,
      Role: [person(0, "Ellis"), person(3, "June"), person(2, "The Director")],
    });
    for (let s = 1; s <= sh.seasons; s++) {
      const seasonId = String(nextId++);
      items.set(seasonId, {
        ratingKey: seasonId, key: `/library/metadata/${seasonId}/children`, type: "season", title: `Season ${s}`, index: s,
        parentRatingKey: showId, parentTitle: sh.title, thumb: `/img/poster${si + 3}`, art: `/img/art${si + 5}`, librarySectionID: 2,
      });
      for (let e = 1; e <= 6; e++) {
        const id = String(nextId++);
        items.set(id, {
          ratingKey: id, key: `/library/metadata/${id}`, type: "episode", title: ["Pilot", "Undertow", "The Night Shift", "Lanterns", "Second Act", "Curtain"][e - 1],
          index: e, parentIndex: s, parentRatingKey: seasonId, parentTitle: `Season ${s}`, grandparentRatingKey: showId, grandparentTitle: sh.title,
          grandparentThumb: `/img/poster${si + 3}`, grandparentArt: `/img/art${si + 5}`, thumb: `/img/art${((e + s) % 8) + 1}`,
          summary: "Something small goes wrong, and then everything else does too.", duration: DURATION,
          originallyAvailableAt: `2022-0${s}-${String(e * 3).padStart(2, "0")}`, librarySectionID: 2, librarySectionTitle: "TV Shows",
          addedAt: 1_760_000_500 - e * 60,
          Role: [person(0, "Ellis"), person(3, "June")],
          Marker: [
            { type: "intro", startTimeOffset: 15_000, endTimeOffset: 45_000 },
            { type: "credits", startTimeOffset: 160_000, endTimeOffset: 180_000, final: true },
          ],
          Media: mediaFor(id),
        });
      }
    }
  });
  return { name, items, state: new Map(), sections, playlists: [], collections: [] };
}

const home = buildLibrary(
  "Unraid",
  ["Northern Lights", "The Quiet Harbor", "Glass Orchard", "Paper Satellites", "A Long Way to Kestrel", "Midnight Cartography", "The Ninth Lantern", "Saltwater Hymn", "Copper Moon", "Vanishing Point Road", "Little Engines", "The Archivist", "Heatwave", "Static Bloom", "Ferryman", "Orbit of Small Things", "The Last Arcade", "Winter Signal"],
  [{ title: "Harborlight", seasons: 2 }, { title: "The Understudies", seasons: 1 }],
  [
    { key: "1", title: "Movies", type: "movie" },
    { key: "2", title: "TV Shows", type: "show" },
    { key: "3", title: "Anime", type: "show" },
    { key: "4", title: "Kids Movies", type: "movie" },
    { key: "5", title: "Music", type: "artist" }, // not a video library: never shown
  ],
);
home.state.set("101", { viewOffset: 62_000, viewCount: 0, updated: Date.now() - 1000 });
home.playlists.push({ ratingKey: "7001", title: "Rainy day", items: ["100", "102"] }, { ratingKey: "7002", title: "Date night", items: [] });
home.collections.push({ ratingKey: "8001", title: "Mock Classics", section: "1", items: ["103"] });

// A second, shared server whose ratingKeys overlap the first one's (like real servers do).
const friend = buildLibrary("Friend's server", ["Driftwood", "Signal Fires", "Blue Hour", "Paper Kites", "The Long Thaw"], [], [
  { key: "1", title: "Films", type: "movie" },
]);
friend.state.set("102", { viewOffset: 40_000, viewCount: 0, updated: Date.now() - 60_000 });

function view(lib: Lib, it: Item): Item {
  const st = lib.state.get(it.ratingKey);
  const out: Item = { ...it };
  if (st) {
    if (st.viewOffset) out.viewOffset = st.viewOffset;
    if (st.viewCount) out.viewCount = st.viewCount;
    if (st.updated) out.lastViewedAt = Math.floor(st.updated / 1000);
  }
  if (it.type === "show" || it.type === "season") {
    const leaves = leavesOf(lib, it.ratingKey);
    out.leafCount = leaves.length;
    out.viewedLeafCount = leaves.filter((l) => lib.state.get(l.ratingKey)?.viewCount).length;
  }
  return out;
}
const childrenOf = (lib: Lib, id: string) => [...lib.items.values()].filter((x) => x.parentRatingKey === id).sort((a, b) => a.index - b.index);
const leavesOf = (lib: Lib, id: string): Item[] => {
  const it = lib.items.get(id);
  if (it?.type === "season") return childrenOf(lib, id);
  return childrenOf(lib, id).flatMap((s) => childrenOf(lib, s.ratingKey));
};
function onDeck(lib: Lib, showId: string) {
  const leaves = leavesOf(lib, showId);
  return leaves.find((l) => lib.state.get(l.ratingKey)?.viewOffset) ?? leaves.find((l) => !lib.state.get(l.ratingKey)?.viewCount);
}
function continueWatching(lib: Lib) {
  return [...lib.state.entries()]
    .filter(([, s]) => s.viewOffset > 0)
    .sort((a, b) => b[1].updated - a[1].updated)
    .map(([id]) => view(lib, lib.items.get(id)!));
}

// ---------- helpers ----------
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });
const mc = (o: Item) => json({ MediaContainer: o });

async function file(path: string, req: Request, type?: string) {
  const f = Bun.file(path);
  if (!(await f.exists())) return new Response("nf", { status: 404, headers: CORS });
  const range = req.headers.get("range");
  const headers: Record<string, string> = { ...CORS, "Accept-Ranges": "bytes", "Content-Type": type ?? f.type };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)!;
    const s = m[1] ? +m[1] : 0;
    const e = m[2] ? +m[2] : Math.min(f.size - 1, s + 4_000_000);
    return new Response(f.slice(s, e + 1), { status: 206, headers: { ...headers, "Content-Range": `bytes ${s}-${e}/${f.size}` } });
  }
  return new Response(f, { headers });
}

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- plex.tv ----------
let pinChecks = 0;
const watchlisted = new Set<string>();
Bun.serve({
  port: 4100,
  async fetch(req) {
    const u = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (u.pathname === "/" || u.pathname === "/index.html") return file(join(DIST, "index.html"), req);
    if (u.pathname.startsWith("/assets/")) return file(join(DIST, u.pathname), req);
    // cast photos (real Plex serves these from metadata-static.plex.tv as absolute URLs)
    if (u.pathname.startsWith("/img/")) return file(join(MEDIA, `img/${u.pathname.slice(5)}.jpg`), req, "image/jpeg");
    if (u.pathname === "/api/v2/pins" && req.method === "POST") {
      pinChecks = 0;
      return json({ id: 1, code: "K7QX", authToken: null, expiresIn: 900 }, 201);
    }
    if (u.pathname === "/api/v2/pins/1") return json({ id: 1, code: "K7QX", authToken: ++pinChecks >= 2 ? "user-token" : null });
    const token = u.searchParams.get("X-Plex-Token");
    if (u.pathname === "/api/v2/user") return token === "user-token" ? json({ id: 1, uuid: "u", username: "nicolas", title: "Nicolas", thumb: "" }) : json({}, 401);
    if (u.pathname === "/api/v2/resources") {
      if (token !== "user-token") return json([], 401);
      return json([
        { name: "Unraid", clientIdentifier: "machine-1", provides: "server", owned: true, presence: true, accessToken: "server-token",
          connections: [
            { uri: "http://localhost:9", protocol: "http", address: "203.0.113.5", port: 9, local: false, relay: false },
            { uri: "http://localhost:32400", protocol: "http", address: "192.168.1.10", port: 32400, local: true, relay: false },
          ] },
        { name: "Friend's server", clientIdentifier: "machine-2", provides: "server", owned: false, presence: true, accessToken: "friend-token",
          connections: [{ uri: "http://localhost:32401", protocol: "http", address: "198.51.100.7", port: 32401, local: false, relay: false }] },
        { name: "Old laptop", clientIdentifier: "machine-3", provides: "server", owned: true, presence: false, accessToken: "x",
          connections: [{ uri: "http://localhost:9", protocol: "http", address: "198.51.100.9", port: 9, local: false, relay: true }] },
      ]);
    }
    // Plex Discover watchlist (the app uses <plextv>/discover when ?plextv= is set)
    let w: RegExpExecArray | null;
    if ((w = /^\/discover\/library\/metadata\/([^/]+)\/userState$/.exec(u.pathname)))
      return json({ MediaContainer: { UserState: watchlisted.has(w[1]) ? { watchlistedAt: 1_760_000_000 } : {} } });
    if ((w = /^\/discover\/actions\/(addToWatchlist|removeFromWatchlist)$/.exec(u.pathname))) {
      const id = u.searchParams.get("ratingKey")!;
      if (w[1] === "addToWatchlist") watchlisted.add(id); else watchlisted.delete(id);
      log("watchlist", w[1], id);
      return json({});
    }
    return json({ error: "mock plex.tv: no route" }, 404);
  },
});

// ---------- Plex Media Server ----------
function pms(port: number, machineId: string, token: string, lib: Lib) {
Bun.serve({
  port,
  async fetch(req) {
    const u = new URL(req.url);
    const p = decodeURIComponent(u.pathname);
    const q = u.searchParams;
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    // Transcode segments are authorised by their session, like the real server.
    const segment = /^\/video\/:\/transcode\/universal\/(init\.mp4|seg\d+\.m4s)$/.test(p);
    if (!segment && q.get("X-Plex-Token") !== token) return json({ error: "unauthorized" }, 401);

    if (p === "/identity") return mc({ machineIdentifier: machineId, version: "1.42.0", friendlyName: lib.name });
    if (p === "/library/sections")
      return mc({ Directory: lib.sections });
    if (p === "/hubs/continueWatching") return mc({ Hub: [{ title: "Continue Watching", hubIdentifier: "home.continue", type: "mixed", Metadata: continueWatching(lib) }] });
    if (p === "/hubs") {
      const movies = [...lib.items.values()].filter((x) => x.type === "movie").sort((a, b) => b.addedAt - a.addedAt).map((x) => view(lib, x));
      const eps = [...lib.items.values()].filter((x) => x.type === "episode").sort((a, b) => b.addedAt - a.addedAt).slice(0, 12).map((x) => view(lib, x));
      const showsList = [...lib.items.values()].filter((x) => x.type === "show").map((x) => view(lib, x));
      return mc({ Hub: [
        { title: "Continue Watching", hubIdentifier: "home.continue", type: "mixed", Metadata: continueWatching(lib) },
        { title: "Recently Added Movies", hubIdentifier: "movie.recentlyadded.1", type: "movie", Metadata: movies.slice(0, 14) },
        { title: "Recently Added TV", hubIdentifier: "tv.recentlyadded.2", type: "episode", Metadata: eps },
        { title: "TV Shows", hubIdentifier: "tv.shows.2", type: "show", Metadata: showsList },
        { title: "Recently Played Music", hubIdentifier: "music.recent", type: "album", Metadata: [{ ratingKey: "9", type: "album", title: "x" }] },
      ] });
    }
    if (p === "/hubs/search") {
      const term = (q.get("query") ?? "").toLowerCase();
      const hit = [...lib.items.values()].filter((x) => x.title.toLowerCase().includes(term) || (x.grandparentTitle ?? "").toLowerCase().includes(term)).map((x) => view(lib, x));
      return mc({ Hub: ["movie", "show", "episode"].map((t) => ({ title: t === "movie" ? "Movies" : t === "show" ? "Shows" : "Episodes", hubIdentifier: t, type: t, Metadata: hit.filter((h) => h.type === t) })) });
    }
    let m: RegExpExecArray | null;
    if ((m = /^\/library\/sections\/(\d+)\/all$/.exec(p))) {
      const type = lib.sections.find((x) => x.key === m![1])?.type === "show" ? "show" : "movie";
      let list = [...lib.items.values()].filter((x) => x.type === type).map((x) => view(lib, x));
      // person filter (actor / director / writer = tag id)
      for (const [param, field] of [["actor", "Role"], ["director", "Director"], ["writer", "Writer"]] as const) {
        const pid = q.get(param);
        if (pid) list = [...lib.items.values()].filter((x) => (x.type === "movie" || x.type === "show") && x[field]?.some((r: Item) => String(r.id) === pid)).map((x) => view(lib, x));
      }
      const sort = q.get("sort") ?? "";
      if (sort.startsWith("titleSort")) list.sort((a, b) => a.title.localeCompare(b.title));
      else list.sort((a, b) => b.addedAt - a.addedAt);
      const start = Number(q.get("X-Plex-Container-Start") ?? 0), size = Number(q.get("X-Plex-Container-Size") ?? 50);
      return mc({ totalSize: list.length, size: Math.min(size, list.length - start), Metadata: list.slice(start, start + size) });
    }
    if ((m = /^\/hubs\/sections\/(\d+)$/.exec(p))) return mc({ Hub: [] });
    if ((m = /^\/library\/metadata\/(\d+)\/children$/.exec(p))) return mc({ Metadata: childrenOf(lib, m[1]).map((x) => view(lib, x)) });
    if ((m = /^\/library\/metadata\/(\d+)\/allLeaves$/.exec(p))) return mc({ Metadata: leavesOf(lib, m[1]).map((x) => view(lib, x)) });
    if ((m = /^\/library\/metadata\/(\d+)\/related$/.exec(p))) {
      const others = [...lib.items.values()].filter((x) => x.type === "movie" && x.ratingKey !== m![1]).slice(0, 10).map((x) => view(lib, x));
      return mc({ Hub: [{ title: "More Like This", hubIdentifier: "related", type: "movie", Metadata: others }] });
    }
    // playlists & collections
    if (p === "/playlists") return mc({ Metadata: lib.playlists.map((pl) => ({ ratingKey: pl.ratingKey, title: pl.title, type: "playlist", playlistType: "video", leafCount: pl.items.length })) });
    if ((m = /^\/playlists\/(\d+)\/items$/.exec(p)) && req.method === "PUT") {
      const pl = lib.playlists.find((x) => x.ratingKey === m![1]);
      const id = /\/library\/metadata\/(\d+)/.exec(q.get("uri") ?? "")?.[1];
      if (!pl || !id) return json({}, 400);
      pl.items.push(id);
      log(lib.name, "playlist add", pl.title, id);
      return mc({ leafCountAdded: 1 });
    }
    if ((m = /^\/library\/sections\/(\d+)\/collections$/.exec(p)))
      return mc({ Metadata: lib.collections.filter((c) => c.section === m![1]).map((c) => ({ ratingKey: c.ratingKey, title: c.title, type: "collection", childCount: c.items.length })) });
    if ((m = /^\/library\/collections\/(\d+)\/items$/.exec(p)) && req.method === "PUT") {
      const c = lib.collections.find((x) => x.ratingKey === m![1]);
      const id = /\/library\/metadata\/(\d+)/.exec(q.get("uri") ?? "")?.[1];
      if (!c || !id) return json({}, 400);
      c.items.push(id);
      log(lib.name, "collection add", c.title, id);
      return json({});
    }
    // manage
    if ((m = /^\/library\/metadata\/(\d+)\/(refresh|analyze)$/.exec(p)) && req.method === "PUT") {
      log(lib.name, m[2], m[1]);
      return json({});
    }
    if ((m = /^\/library\/metadata\/(\d+)$/.exec(p)) && req.method === "DELETE") {
      lib.items.delete(m[1]);
      log(lib.name, "delete", m[1]);
      return json({});
    }
    if ((m = /^\/library\/metadata\/(\d+)$/.exec(p))) {
      const it = lib.items.get(m[1]);
      if (!it) return json({}, 404);
      const v = view(lib, it);
      if (it.type === "show") {
        const d = onDeck(lib, it.ratingKey);
        if (d) v.OnDeck = { Metadata: [view(lib, d)] };
      }
      return mc({ Metadata: [v] });
    }
    if ((m = /^\/library\/parts\/(\d+)$/.exec(p)) && req.method === "PUT") {
      log("select streams", Object.fromEntries(q));
      const partId = Number(m[1]);
      for (const it of lib.items.values()) {
        const part = it.Media?.[0]?.Part?.[0];
        if (part?.id !== partId) continue;
        for (const s of part.Stream) {
          if (q.has("audioStreamID") && s.streamType === 2) s.selected = s.id === Number(q.get("audioStreamID"));
          if (q.has("subtitleStreamID") && s.streamType === 3) s.selected = s.id === Number(q.get("subtitleStreamID"));
        }
      }
      return json({});
    }
    if ((m = /^\/library\/streams\/(\d+)$/.exec(p))) {
      // external SRT: a line every 4 seconds
      let srt = "";
      const ts = (t: number) => new Date(t * 1000).toISOString().slice(11, 23).replace(".", ",");
      for (let i = 0, t = 1; t < 178; i++, t += 4) srt += `${i + 1}\n${ts(t)} --> ${ts(t + 3)}\n${i % 3 === 0 ? "<i>Subtitle line " + (i + 1) + "</i>" : "Subtitle line " + (i + 1)}\n${i % 2 ? "second row of text\n" : ""}\n`;
      return new Response(srt, { headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS } });
    }
    if ((m = /^\/library\/parts\/\d+\/\d+\/file\.webm$/.exec(p))) return file(join(MEDIA, "video.webm"), req, "video/webm");

    if (p === "/photo/:/transcode") {
      const src = q.get("url") ?? "";
      const frame = /\/indexes\/sd\/(\d+)/.exec(src);
      if (frame) {
        const n = Math.min(36, Math.floor(Number(frame[1]) / 5000) + 1);
        return file(join(MEDIA, `frames/f${String(n).padStart(3, "0")}.jpg`), req, "image/jpeg");
      }
      const img = /\/img\/(\w+)/.exec(src);
      return file(join(MEDIA, `img/${img?.[1] ?? "art1"}.jpg`), req, "image/jpeg");
    }

    if (p === "/:/timeline") {
      const id = q.get("ratingKey")!;
      const t = Number(q.get("time"));
      const prev = lib.state.get(id) ?? { viewOffset: 0, viewCount: 0, updated: 0 };
      lib.state.set(id, { ...prev, viewOffset: q.get("state") === "stopped" && t > DURATION * 0.9 ? 0 : t, updated: Date.now() });
      log(lib.name, "timeline", id, q.get("state"), t);
      return json({});
    }
    if (p === "/:/scrobble" || p === "/:/unscrobble") {
      const id = q.get("key")!;
      const ids = lib.items.get(id)?.type === "movie" || lib.items.get(id)?.type === "episode" ? [id] : leavesOf(lib, id).map((l) => l.ratingKey);
      for (const x of ids) lib.state.set(x, { viewOffset: 0, viewCount: p === "/:/scrobble" ? 1 : 0, updated: Date.now() });
      log(p, id);
      return json({});
    }

    if (p === "/video/:/transcode/universal/decision") {
      log("decision", q.get("path"), "bitrate", q.get("maxVideoBitrate"), "subtitles", q.get("subtitles"));
      return mc({ generalDecisionCode: 1000, generalDecisionText: "Direct play not available; transcoding" });
    }
    if (p === "/video/:/transcode/universal/start.m3u8") {
      log("transcode start", q.get("session"), q.get("path"));
      return file(join(MEDIA, "hls/index.m3u8"), req, "application/vnd.apple.mpegurl");
    }
    if (p === "/video/:/transcode/universal/stop") {
      log("transcode stop", q.get("session"));
      return json({});
    }
    if ((m = /^\/video\/:\/transcode\/universal\/((?:init\.mp4)|(?:seg\d+\.m4s))$/.exec(p))) return file(join(MEDIA, "hls", m[1]), req);

    return json({ error: `mock pms: no route ${p}` }, 404);
  },
});
}

pms(32400, "machine-1", "server-token", home);
pms(32401, "machine-2", "friend-token", friend);

log("mock plex.tv → http://localhost:4100   mock PMS → :32400 (Unraid), :32401 (Friend's server)");
log("open http://localhost:4100/?plextv=http://localhost:4100");
