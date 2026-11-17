// Which games a channel played, worked out from its videos' chapters (Ganymede names chapters
// after the Twitch category). Ganymede can't filter by game itself, so SERAPH reads each video's
// chapters once and keeps them on the TV; archived videos don't change.
import { api, type Video } from "./api";
import { getJSON, setJSON } from "../store";

const cacheKey = (vodId: string) => `sp:gchapters:${vodId}`;

export interface Game {
  name: string;
  count: number;
}

export class ChannelGames {
  videos = $state<Video[]>([]);
  /** vod id → games played in it */
  played = $state<Record<string, string[]>>({});
  done = $state(0);
  total = $state(0);
  loading = $state(true);
  #cancelled = false;

  constructor(private channelId: string) {
    void this.#load();
  }

  async #load() {
    try {
      this.videos = ((await api.channelVideos(this.channelId)) ?? []).filter((v) => v.status === "completed" || !v.status);
    } catch {
      this.loading = false;
      return;
    }
    this.total = this.videos.length;
    const todo: Video[] = [];
    const played: Record<string, string[]> = {};
    for (const v of this.videos) {
      const cached = getJSON<string[] | null>(cacheKey(v.id), null);
      if (cached) played[v.id] = cached;
      else todo.push(v);
    }
    this.played = played;
    this.done = this.total - todo.length;
    // a few at a time, so the server and the TV stay responsive
    const worker = async () => {
      while (todo.length && !this.#cancelled) {
        const v = todo.shift()!;
        const chapters = await api.chapters(v.id).catch(() => null);
        if (!chapters) {
          this.done++;
          continue;
        }
        const games = [...new Set(chapters.map((c) => c.title?.trim()).filter((t): t is string => !!t))];
        setJSON(cacheKey(v.id), games);
        this.played = { ...this.played, [v.id]: games };
        this.done++;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    this.loading = false;
  }

  /** Games by number of videos, most-played first. */
  get games(): Game[] {
    const counts = new Map<string, number>();
    for (const list of Object.values(this.played)) for (const g of list) counts.set(g, (counts.get(g) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  withGame(game: string): Video[] {
    return this.videos.filter((v) => this.played[v.id]?.includes(game));
  }

  cancel() {
    this.#cancelled = true;
  }
}
