// Ganymede as a SERAPH source: server address, sign-in, and watch progress.
//
// Progress syncs with Ganymede when its session cookie works ("server" mode): always on
// Android (the shell serves the UI from Ganymede's own origin) and in desktop dev.
// On Samsung the cookie is usually blocked cross-site, so progress is kept on the TV
// ("local" mode) unless the server's cookie is SameSite=None.

import { api, ApiError, type Playback, type User, type Video } from "./api";
import { gApiKey, gUrl, onGanymedeOrigin, setGApiKey, setGUrl } from "./base";
import { getJSON, setJSON } from "../store";
import { candidates, probeGanymede } from "./address";

export type GPhase = "off" | "checking" | "ready" | "offline";
export type SyncMode = "server" | "local";

type Bridge = { setOrigin?(url: string): void };
const bridge = () => (window as unknown as { SeraphTV?: Bridge }).SeraphTV;

class GanymedeSource {
  url = $state(gUrl());
  phase = $state<GPhase>(gUrl() ? "checking" : "off");
  user = $state<User | null>(null);
  mode = $state<SyncMode>("server");
  /** browsing without an account (Ganymede's library endpoints are public) */
  guest = $state(false);
  error = $state<string | null>(null);
  progress = $state<Record<string, Playback>>({});
  /** optional API key (used for the queue) */
  apiKey = $state(gApiKey());

  setApiKey(key: string) {
    setGApiKey(key);
    this.apiKey = gApiKey();
  }

  /** Which Ganymede user this profile signed in as (to tell its cookie session apart). */
  private get sessionOwnerKey() {
    return `sp:ganymede:sessionUser:${this.url}`;
  }
  private get localUserKey() {
    return `sp:ganymede:localUser:${this.url}`;
  }
  private get localProgressKey() {
    return `sp:ganymede:progress:${this.url}:${this.user?.id ?? ""}`;
  }

  get enabled() {
    return this.phase !== "off";
  }

  async start() {
    if (!this.url) {
      this.phase = "off";
      return;
    }
    // Android: move the UI onto Ganymede's origin so its login cookie is first-party.
    if (bridge()?.setOrigin && !onGanymedeOrigin()) {
      bridge()!.setOrigin!(this.url);
      return;
    }
    this.phase = "checking";
    this.error = null;
    try {
      const me = await api.me();
      // The sign-in cookie is shared by every SERAPH profile on this TV. Only use the session if
      // this profile is the one that signed in; otherwise this profile isn't signed in.
      let mine = getJSON<string | null>(this.sessionOwnerKey, null);
      // Sessions from before profiles existed: with a single profile, it's this one's.
      if (mine === null && getJSON<unknown[]>("sp:profiles", []).length <= 1) {
        mine = me.username;
        setJSON(this.sessionOwnerKey, mine);
      }
      if (mine !== me.username) throw new ApiError(401, "signed in as another profile");
      this.user = me;
      this.mode = "server";
    } catch (e) {
      this.user = null;
      if (e instanceof ApiError && e.status === 0) {
        this.phase = "offline";
        this.error = e.message;
        return;
      }
      const local = getJSON<User | null>(this.localUserKey, null);
      if (local) {
        this.user = local;
        this.mode = "local";
      }
    }
    this.guest = !this.user && getJSON(`sp:ganymede:guest:${this.url}`, false);
    this.phase = "ready";
    await this.loadProgress();
  }

  /**
   * Set (or change) the server from what the user typed or picked. Tries the likely
   * schemes in order (http first for LAN addresses) and keeps the first that answers.
   */
  async connect(input: string) {
    const urls = candidates(input);
    if (!urls.length) throw new Error("Enter an address like 192.168.1.10:4800 or ganymede.example.com");
    let url = "";
    let lastError: Error | null = null;
    for (const u of urls) {
      try {
        await probeGanymede(u);
        url = u;
        break;
      } catch (e) {
        lastError = e as Error;
      }
    }
    if (!url) throw new Error(`${lastError?.message ?? "Can't connect"} (${urls[0]})`);
    setGUrl(url);
    this.url = url;
    this.user = null;
    await this.start();
  }

  disconnect() {
    setGUrl(null);
    this.url = "";
    this.user = null;
    this.progress = {};
    this.phase = "off";
    if (bridge()?.setOrigin && onGanymedeOrigin()) bridge()!.setOrigin!("");
  }

  async login(username: string, password: string) {
    const u = await api.login(username, password);
    try {
      this.user = await api.me();
      this.mode = "server";
      setJSON(this.localUserKey, null);
      setJSON(this.sessionOwnerKey, this.user.username);
    } catch {
      // Credentials accepted but the cookie isn't sent back (cross-site on Samsung).
      this.user = { id: u?.id ?? username, username: u?.username ?? username, role: u?.role ?? "user" };
      this.mode = "local";
      setJSON(this.localUserKey, this.user);
    }
    this.guest = false;
    setJSON(`sp:ganymede:guest:${this.url}`, null);
    await this.loadProgress();
  }

  browseAsGuest() {
    this.guest = true;
    setJSON(`sp:ganymede:guest:${this.url}`, true);
  }

  async logout() {
    await api.logout().catch(() => {});
    setJSON(this.localUserKey, null);
    setJSON(this.sessionOwnerKey, null);
    this.user = null;
    this.mode = "server";
    this.progress = {};
  }

  // ---------- progress ----------
  async loadProgress() {
    if (!this.user) {
      this.progress = {};
      return;
    }
    if (this.mode === "local") {
      this.progress = getJSON(this.localProgressKey, {});
      return;
    }
    try {
      const all = (await api.allProgress()) ?? [];
      const m: Record<string, Playback> = {};
      for (const p of all) m[p.vod_id] = p;
      this.progress = m;
    } catch {
      /* not critical */
    }
  }

  fraction(id: string, duration: number) {
    const p = this.progress[id];
    if (!p) return 0;
    if (p.status === "finished") return 1;
    return duration > 0 ? Math.min(1, p.time / duration) : 0;
  }

  async fetchProgress(id: string): Promise<Playback | null> {
    if (!this.user) return null;
    if (this.mode === "local") return this.progress[id] ?? null;
    try {
      const p = await api.progress(id);
      if (p) this.progress[id] = p;
      return p;
    } catch {
      return this.progress[id] ?? null;
    }
  }

  async continueWatching(limit = 20): Promise<Video[]> {
    if (!this.user) return [];
    if (this.mode === "server") {
      const last = await api.lastPlaybacks(limit).catch(() => null);
      return (last?.data ?? []).filter((x) => x.vod && x.playback?.status !== "finished").map((x) => x.vod);
    }
    const ids = Object.values(this.progress)
      .filter((p) => p.status !== "finished" && p.time > 0)
      .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
      .slice(0, limit)
      .map((p) => p.vod_id);
    const vids = await Promise.all(ids.map((id) => api.video(id).catch(() => null)));
    return vids.filter((v): v is Video => !!v);
  }

  private upsert(id: string, patch: Partial<Playback>) {
    const prev = this.progress[id];
    this.progress[id] = {
      id: prev?.id ?? "",
      vod_id: id,
      time: prev?.time ?? 0,
      status: prev?.status ?? "in_progress",
      ...patch,
      updated_at: new Date().toISOString(),
    };
    if (this.mode === "local") setJSON(this.localProgressKey, this.progress);
  }

  async save(id: string, time: number) {
    if (!this.user) return;
    this.upsert(id, { time });
    if (this.mode === "server") await api.saveProgress(id, time).catch(() => {});
  }

  async setStatus(id: string, status: "in_progress" | "finished") {
    if (!this.user) return;
    this.upsert(id, { status });
    if (this.mode === "server") await api.setStatus(id, status).catch(() => {});
  }

  async clear(id: string) {
    if (!this.user) return;
    delete this.progress[id];
    if (this.mode === "local") setJSON(this.localProgressKey, this.progress);
    else await api.clearProgress(id).catch(() => {});
  }
}

export const ganymede = new GanymedeSource();
