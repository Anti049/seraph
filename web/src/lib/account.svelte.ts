// Signed-in Plex account and the servers in use. Several servers can be active at once (your own
// plus ones shared with you); their libraries are merged across Home, the side menu and search.
import { pickConnection, plexTv, PlexError, PlexServer, invalidatePlex, type Metadata, type PlexUser, type Resource } from "./plex";
import { getItem as load, getJSON, setItem as save, setJSON } from "./store";

const K = { token: "sp:token", servers: "sp:servers", legacyServer: "sp:server" };

interface SavedServer {
  machineId: string;
  name: string;
  uri: string;
  token: string;
  local: boolean;
}

export type Phase = "starting" | "signedOut" | "choosingServer" | "connecting" | "ready" | "error";

class Account {
  phase = $state<Phase>("starting");
  token = $state<string | null>(load(K.token));
  user = $state<PlexUser | null>(null);
  /** Servers linked to the account (from plex.tv). */
  resources = $state<Resource[]>([]);
  /** Servers in use, in the order they were added. */
  connected = $state<PlexServer[]>([]);
  /** Chosen servers that couldn't be reached this time. */
  unreachable = $state<string[]>([]);
  error = $state<string | null>(null);

  /** The first server (used where one server has to be picked, e.g. its quality default). */
  get server(): PlexServer | null {
    return this.connected[0] ?? null;
  }

  get ready(): boolean {
    return this.phase === "ready" && this.connected.length > 0;
  }

  #saved(): SavedServer[] {
    const list = getJSON<SavedServer[] | null>(K.servers, null);
    if (list) return list;
    const legacy = getJSON<SavedServer | null>(K.legacyServer, null); // from before multi-server
    return legacy ? [legacy] : [];
  }

  #persist() {
    setJSON(
      K.servers,
      this.connected.map((s) => ({ machineId: s.machineId, name: s.name, uri: s.uri, token: s.token, local: s.local }) satisfies SavedServer),
    );
    save(K.legacyServer, null);
  }

  async start() {
    if (!this.token) {
      this.phase = "signedOut";
      return;
    }
    this.phase = "connecting";
    try {
      this.user = await plexTv.user(this.token);
    } catch (e) {
      if (e instanceof PlexError && e.status === 401) return this.signOut();
      // plex.tv unreachable: still try the saved servers directly (LAN keeps working)
    }
    const saved = this.#saved();
    if (!saved.length) return this.discover();

    // Try every saved server at its last address; rediscover the ones that moved.
    const results = await Promise.all(
      saved.map(async (s) => {
        const server = new PlexServer(s.uri, s.token, s.name, s.machineId, s.local);
        try {
          await server.sections();
          return server;
        } catch {
          return null;
        }
      }),
    );
    this.connected = results.filter((s): s is PlexServer => !!s);
    const missing = saved.filter((s, i) => !results[i]).map((s) => s.machineId);
    if (missing.length) {
      try {
        this.resources = await plexTv.resources(this.token);
        for (const id of missing) {
          const res = this.resources.find((r) => r.clientIdentifier === id);
          if (res) await this.#open(res).catch(() => {});
        }
      } catch {
        /* plex.tv unreachable */
      }
    }
    this.unreachable = saved.map((s) => s.machineId).filter((id) => !this.connected.some((c) => c.machineId === id));
    if (this.connected.length) {
      this.phase = "ready";
      this.#persist();
    } else await this.discover();
  }

  /** List servers from plex.tv; connect the only one automatically, otherwise let the user choose. */
  async discover() {
    if (!this.token) return;
    this.phase = "connecting";
    this.error = null;
    try {
      this.resources = await plexTv.resources(this.token);
    } catch (e) {
      this.error = (e as Error).message;
      this.phase = "error";
      return;
    }
    if (!this.resources.length) {
      this.error = "No Plex Media Servers are linked to this account.";
      this.phase = "error";
      return;
    }
    if (this.resources.length === 1 && !this.connected.length) {
      await this.add(this.resources[0]);
      if (this.connected.length) this.phase = "ready";
      return;
    }
    this.phase = "choosingServer";
  }

  async #open(res: Resource): Promise<PlexServer> {
    const uri = await pickConnection(res);
    const conn = res.connections.find((c) => c.uri === uri);
    const s = new PlexServer(uri, res.accessToken || this.token!, res.name, res.clientIdentifier, !!conn?.local);
    this.connected = [...this.connected.filter((c) => c.machineId !== s.machineId), s];
    return s;
  }

  /** Start using a server (keeps the others). */
  async add(res: Resource): Promise<boolean> {
    this.error = null;
    try {
      await this.#open(res);
      this.unreachable = this.unreachable.filter((id) => id !== res.clientIdentifier);
      this.#persist();
      invalidatePlex();
      return true;
    } catch (e) {
      this.error = `${res.name}: ${(e as Error).message}`;
      return false;
    }
  }

  /** Stop using a server. */
  remove(machineId: string) {
    this.connected = this.connected.filter((s) => s.machineId !== machineId);
    this.unreachable = this.unreachable.filter((id) => id !== machineId);
    this.#persist();
    invalidatePlex();
  }

  isConnected(machineId: string) {
    return this.connected.some((s) => s.machineId === machineId);
  }

  /** Close the server chooser (needs at least one server). */
  doneChoosing() {
    if (this.connected.length) this.phase = "ready";
  }

  async signedIn(token: string) {
    this.token = token;
    save(K.token, token);
    try {
      this.user = await plexTv.user(token);
    } catch {
      /* non-fatal */
    }
    await this.discover();
  }

  manageServers() {
    this.phase = "choosingServer";
    if (!this.resources.length) void this.refreshResources();
  }

  async refreshResources() {
    if (!this.token) return;
    try {
      this.resources = await plexTv.resources(this.token);
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  signOut() {
    save(K.token, null);
    save(K.servers, null);
    save(K.legacyServer, null);
    this.token = null;
    this.user = null;
    this.connected = [];
    this.resources = [];
    this.unreachable = [];
    this.phase = "signedOut";
    invalidatePlex();
  }
}

export const account = new Account();

/** A connected server by machine id (default: the first). Only call once Plex is ready. */
export function plex(machineId?: string): PlexServer {
  const s = (machineId && account.connected.find((c) => c.machineId === machineId)) || account.connected[0];
  if (!s) throw new Error("Not connected to a Plex server");
  return s;
}

/** The server an item came from. */
export const plexFor = (m: Pick<Metadata, "server">): PlexServer => plex(m.server);
