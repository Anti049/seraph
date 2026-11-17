// SERAPH profiles: each has its own Plex account and servers, Ganymede sign-in, settings,
// library arrangement and local watch progress (see store.ts for how keys are separated).
import { activeProfile, getJSON, MAIN_PROFILE, setItem, setJSON } from "./store";

export interface Profile {
  id: string;
  name: string;
  /** Catppuccin accent used for the avatar. */
  color: string;
}

export const PROFILE_COLORS = ["#cba6f7", "#f5c2e7", "#fab387", "#f9e2af", "#a6e3a1", "#94e2d5", "#89b4fa", "#b4befe", "#f38ba8"];

const K = { list: "sp:profiles", active: "sp:profile", picked: "sp:profile-picked" };

class Profiles {
  list = $state<Profile[]>(getJSON<Profile[]>(K.list, []));
  readonly activeId = activeProfile;

  constructor() {
    if (!this.list.length) this.list = [{ id: MAIN_PROFILE, name: "Me", color: PROFILE_COLORS[0] }];
  }

  get active(): Profile {
    return this.list.find((p) => p.id === this.activeId) ?? this.list[0];
  }

  /** Show the picker at launch when there's more than one profile (once per app start). */
  get needsPick(): boolean {
    if (this.list.length < 2) return false;
    try {
      return sessionStorage.getItem(K.picked) !== "1";
    } catch {
      return false;
    }
  }

  #save() {
    setJSON(K.list, this.list);
  }

  add(name: string): Profile {
    const used = new Set(this.list.map((p) => p.color));
    const p: Profile = {
      id: Math.random().toString(36).slice(2, 10),
      name: name.trim() || `Profile ${this.list.length + 1}`,
      color: PROFILE_COLORS.find((c) => !used.has(c)) ?? PROFILE_COLORS[this.list.length % PROFILE_COLORS.length],
    };
    this.list = [...this.list, p];
    this.#save();
    return p;
  }

  rename(id: string, name: string) {
    this.list = this.list.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p));
    this.#save();
  }

  setColor(id: string, color: string) {
    this.list = this.list.map((p) => (p.id === id ? { ...p, color } : p));
    this.#save();
  }

  /** Remove a profile and everything stored for it. The main profile can't be removed. */
  remove(id: string) {
    if (id === MAIN_PROFILE || id === this.activeId) return;
    this.list = this.list.filter((p) => p.id !== id);
    this.#save();
    const prefix = `sp:p:${id}:`;
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k);
    } catch {
      /* Android keeps them in SharedPreferences; they're simply orphaned */
    }
  }

  /** Switch profile: everything reloads under the new profile. */
  use(id: string) {
    try {
      sessionStorage.setItem(K.picked, "1");
    } catch {
      /* ignore */
    }
    if (id === this.activeId) return false;
    setItem(K.active, id);
    location.reload();
    return true;
  }

  /** Mark the picker as done without switching (kept the current profile). */
  keep() {
    this.use(this.activeId);
  }
}

export const profiles = new Profiles();
