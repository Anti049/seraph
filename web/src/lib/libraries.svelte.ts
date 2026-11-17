// Which Plex libraries appear in the side menu, in what order, with which icon, across every
// connected server. Stored per profile; library ids are "<server machine id>:<section key>".

import { account } from "./account.svelte";
import type { Section } from "./plex";
import { getJSON, setJSON } from "./store";

export const LIBRARY_ICONS = [
  "movie", "tv", "live-tv", "theaters", "video-library", "animation", "child-care", "family-restroom",
  "sports-soccer", "sports-esports", "school", "music-video", "theater-comedy", "rocket-launch",
  "forest", "pets", "public", "favorite", "star", "folder",
];

/** Library types this app can browse and play. */
const VIDEO_TYPES = ["movie", "show"];

interface Prefs {
  order: string[];
  hidden: string[];
  icons: Record<string, string>;
}

export interface Library {
  /** "<machineId>:<sectionKey>" */
  id: string;
  section: Section & { server: string };
  /** Server name, shown when more than one server is connected. */
  serverName: string;
  icon: string;
  hidden: boolean;
}

const KEY = "sp:plexLibraries";
const legacyKey = (machineId: string) => `sp:plexLibraries:${machineId}`;
const defaultIcon = (s: Section) => (s.type === "show" ? "tv" : "movie");

class Libraries {
  sections = $state<(Section & { server: string })[]>([]);
  prefs = $state<Prefs>(getJSON<Prefs>(KEY, { order: [], hidden: [], icons: {} }));

  /** Load the libraries of every connected server. */
  async load() {
    if (!account.ready) {
      this.sections = [];
      return;
    }
    const lists = await Promise.all(
      account.connected.map((s) =>
        s
          .sections()
          .then((l) => l.filter((x) => VIDEO_TYPES.includes(x.type)).map((x) => ({ ...x, server: s.machineId })))
          .catch(() => this.sections.filter((x) => x.server === s.machineId)),
      ),
    );
    this.sections = lists.flat();
    this.#migrate();
  }

  /** Arrangements saved per server before multi-server support move into the shared list. */
  #migrate() {
    let changed = false;
    const p: Prefs = { order: [...this.prefs.order], hidden: [...this.prefs.hidden], icons: { ...this.prefs.icons } };
    for (const s of account.connected) {
      const old = getJSON<Prefs | null>(legacyKey(s.machineId), null);
      if (!old) continue;
      const id = (k: string) => `${s.machineId}:${k}`;
      p.order.push(...old.order.map(id).filter((x) => !p.order.includes(x)));
      p.hidden.push(...old.hidden.map(id).filter((x) => !p.hidden.includes(x)));
      for (const [k, v] of Object.entries(old.icons)) p.icons[id(k)] ??= v;
      setJSON(legacyKey(s.machineId), null);
      changed = true;
    }
    if (changed) this.#save(p);
  }

  /** All libraries in display order (user order first, new libraries appended). */
  get all(): Library[] {
    const multi = new Set(this.sections.map((s) => s.server)).size > 1;
    const rank = (k: string) => {
      const i = this.prefs.order.indexOf(k);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    return this.sections
      .map((section) => ({ section, id: `${section.server}:${section.key}` }))
      .sort((a, b) => rank(a.id) - rank(b.id) || this.sections.indexOf(a.section) - this.sections.indexOf(b.section))
      .map(({ section, id }) => ({
        id,
        section,
        serverName: multi ? (account.connected.find((c) => c.machineId === section.server)?.name ?? "") : "",
        icon: this.prefs.icons[id] ?? defaultIcon(section),
        hidden: this.prefs.hidden.includes(id),
      }));
  }

  get visible(): Library[] {
    return this.all.filter((l) => !l.hidden);
  }

  #save(p: Prefs) {
    this.prefs = p;
    setJSON(KEY, p);
  }

  toggle(id: string) {
    const hidden = this.prefs.hidden.includes(id) ? this.prefs.hidden.filter((x) => x !== id) : [...this.prefs.hidden, id];
    this.#save({ ...this.prefs, hidden });
  }

  move(id: string, dir: -1 | 1) {
    const order = this.all.map((l) => l.id);
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this.#save({ ...this.prefs, order });
  }

  setIcon(id: string, icon: string) {
    this.#save({ ...this.prefs, icons: { ...this.prefs.icons, [id]: icon } });
  }

  reset() {
    this.#save({ order: [], hidden: [], icons: {} });
  }
}

export const libraries = new Libraries();
