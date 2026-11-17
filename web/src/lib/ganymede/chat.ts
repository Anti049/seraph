// Chat replay engine: follows the video clock, prefetches comments in windows,
// and releases them as the playhead passes their offset (same approach as the
// Ganymede web player, trimmed for TV hardware).

import { api, media, type ChatBadge, type ChatComment, type ChatEmote } from "./api";

export type Fragment = { t: "text"; text: string } | { t: "emote"; url: string; name: string };

export interface ChatLine {
  id: string;
  name: string;
  color: string;
  badges: { url: string; title: string }[];
  fragments: Fragment[];
  kind: "normal" | "action" | "notice" | "bits" | "first" | "system";
  offset: number;
}

const WINDOW = 10; // seconds fetched per request
const LOOKAHEAD = 4; // fetch the next window this many seconds early
const MAX_LINES = 120;
const IGNORED_BADGES = new Set(["no_audio", "no_video", "predictions"]);
const SUB_BADGES = new Set(["subscriber", "sub-gifter", "sub_gifter", "bits"]);

// Twitch's default name palette for users without a colour.
const NAME_COLORS = ["#FF4A4A", "#4A6BFF", "#3FCF5E", "#B22222", "#FF7F50", "#9ACD32", "#FF6A2B", "#2E8B57", "#DAA520", "#D2691E", "#5F9EA0", "#3C8CFF", "#FF69B4", "#A66BFF", "#00FF7F"];

function fallbackColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return NAME_COLORS[Math.abs(h) % NAME_COLORS.length];
}

export class ChatReplay {
  lines: ChatLine[] = [];
  private emoteById = new Map<string, ChatEmote>();
  private emoteByName = new Map<string, ChatEmote>();
  private subBadges = new Map<string, ChatBadge>();
  private bitBadges = new Map<string, ChatBadge>();
  private badges = new Map<string, ChatBadge>();
  private queue: ChatComment[] = [];
  private seen = new Set<string>();
  private fetchedUntil = -1;
  private lastTime = -1;
  private loading = false;
  private generation = 0;
  private ready = false;

  constructor(private videoId: string, private onChange: (lines: ChatLine[]) => void) {}

  async init() {
    const [emotes, badges] = await Promise.all([
      api.chatEmotes(this.videoId).catch(() => null),
      api.chatBadges(this.videoId).catch(() => null),
    ]);
    for (const e of emotes ?? []) {
      if (!e.name || e.type === "twitch") this.emoteById.set(e.id, e);
      else {
        this.emoteById.set(e.name, e);
        this.emoteByName.set(e.name, e);
      }
    }
    for (const b of badges ?? []) {
      if (b.name === "subscriber") this.subBadges.set(b.version, b);
      else if (b.name === "bits") this.bitBadges.set(b.version, b);
      else if (!IGNORED_BADGES.has(b.name)) this.badges.set(b.name, b);
    }
    this.ready = true;
    this.system("Chat replay ready");
  }

  /** Call regularly with the current playhead. */
  tick(time: number) {
    if (!this.ready) return;
    const jumped = this.lastTime >= 0 && (time < this.lastTime - 1 || time > this.lastTime + 6);
    if (this.lastTime < 0 || jumped) {
      this.seek(time);
    } else if (!this.loading && time + LOOKAHEAD >= this.fetchedUntil) {
      this.fetchRange(this.fetchedUntil, this.fetchedUntil + WINDOW);
    }
    this.lastTime = time;
    this.release(time);
  }

  private async seek(time: number) {
    const gen = ++this.generation;
    this.queue = [];
    this.seen.clear();
    if (this.lastTime >= 0) {
      this.lines = [];
      this.onChange(this.lines);
    }
    this.fetchedUntil = time;
    this.loading = true;
    try {
      const before = (await api.chatSeek(this.videoId, Math.floor(time), 40)) ?? [];
      if (gen !== this.generation) return;
      this.enqueue(before);
      this.release(time);
    } catch {
      /* ignore; range fetch below still runs */
    } finally {
      if (gen === this.generation) this.loading = false;
    }
    if (gen === this.generation) this.fetchRange(time, time + WINDOW);
  }

  private async fetchRange(start: number, end: number) {
    const gen = this.generation;
    this.loading = true;
    try {
      const data = (await api.chatRange(this.videoId, Math.floor(start), Math.ceil(end))) ?? [];
      if (gen !== this.generation) return;
      this.enqueue(data);
      this.fetchedUntil = end;
    } catch {
      if (gen === this.generation) this.fetchedUntil = end; // skip a bad window rather than retry forever
    } finally {
      if (gen === this.generation) this.loading = false;
    }
  }

  private enqueue(comments: ChatComment[]) {
    for (const c of comments) {
      if (this.seen.has(c._id)) continue;
      this.seen.add(c._id);
      this.queue.push(c);
    }
    this.queue.sort((a, b) => a.content_offset_seconds - b.content_offset_seconds);
  }

  private release(time: number) {
    let n = 0;
    while (n < this.queue.length && this.queue[n].content_offset_seconds <= time) n++;
    if (!n) return;
    const out = this.queue.splice(0, n).map((c) => this.format(c));
    this.lines = this.lines.concat(out).slice(-MAX_LINES);
    this.onChange(this.lines);
  }

  private system(text: string) {
    this.lines = this.lines.concat({
      id: `sys-${Date.now()}-${Math.random()}`,
      name: "",
      color: "",
      badges: [],
      fragments: [{ t: "text", text }],
      kind: "system",
      offset: 0,
    });
    this.onChange(this.lines);
  }

  private emoteUrl(e: ChatEmote) {
    return e.type === "embed" ? `data:image/png;base64,${e.url}` : media(e.url);
  }

  private format(c: ChatComment): ChatLine {
    const m = c.message;
    const badges: ChatLine["badges"] = [];
    for (const b of m.user_badges ?? []) {
      if (IGNORED_BADGES.has(b._id)) continue;
      const found = SUB_BADGES.has(b._id)
        ? (b._id === "bits" ? this.bitBadges : this.subBadges).get(b.version)
        : this.badges.get(b._id);
      if (found?.image_url_1x || found?.image_url) badges.push({ url: media(found.image_url_1x || found.image_url), title: found.title });
    }

    const fragments: Fragment[] = [];
    const pushText = (text: string) => {
      const last = fragments[fragments.length - 1];
      if (last && last.t === "text") last.text += text;
      else fragments.push({ t: "text", text });
    };
    const frags = m.fragments?.length ? m.fragments : [{ text: m.body ?? "" }];
    for (const f of frags) {
      const em = "emoticon" in f && f.emoticon ? this.emoteById.get(f.emoticon.emoticon_id) : undefined;
      if (em) {
        fragments.push({ t: "emote", url: this.emoteUrl(em), name: f.text });
        continue;
      }
      const words = (f.text ?? "").split(" ");
      words.forEach((w, i) => {
        const third = this.emoteByName.get(w);
        if (third) fragments.push({ t: "emote", url: this.emoteUrl(third), name: w });
        else pushText(w);
        if (i < words.length - 1) pushText(" ");
      });
    }

    const notice = m.user_notice_params?.msg_id;
    let kind: ChatLine["kind"] = "normal";
    if (notice && notice !== "highlighted-message") kind = "notice";
    else if (m.is_first_message) kind = "first";
    else if (m.is_action) kind = "action";
    else if ((m.bits_spent ?? 0) > 0) kind = "bits";

    const name = c.commenter?.display_name || c.commenter?.name || "unknown";
    return {
      id: c._id,
      name,
      color: m.user_color || fallbackColor(name),
      badges,
      fragments,
      kind,
      offset: c.content_offset_seconds,
    };
  }

  destroy() {
    this.generation++;
    this.ready = false;
  }
}
