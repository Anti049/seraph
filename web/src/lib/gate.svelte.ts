// Which setup screen (if any) must show before the main app, and leaving setup flows.
//
// The root layout watches `gate.required` and navigates to that route; nothing renders screens
// conditionally. Setup flows the user opens themselves (Settings → Add Ganymede…) are ordinary
// pushes; `gate.finish()` returns from either kind.
import { account } from "./account.svelte";
import { ganymede } from "./ganymede/source.svelte";
import { profiles } from "./profiles.svelte";
import { router, setupRoute, type Route, type SetupName } from "./router.svelte";

const SETUP: SetupName[] = ["starting", "welcome", "profiles", "profile-new", "plex-signin", "plex-servers", "g-setup", "g-scan", "g-signin"];

/** Setup screens allowed while a given gate is required (the gate itself plus the steps it leads to). */
const ALLOWED: Partial<Record<SetupName, SetupName[]>> = {
  starting: ["starting"],
  profiles: ["profiles", "profile-new"],
  welcome: ["welcome", "plex-signin", "g-setup", "g-scan", "g-signin"],
  "plex-servers": ["plex-servers"],
  "g-signin": ["g-signin", "g-setup", "g-scan"],
};

class Gate {
  /** Profile chosen this session (or only one profile exists). */
  picked = $state(!profiles.needsPick);
  /** The app path to open once setup is done (a deep link, or where the user was). */
  pending: string | null = null;
  /** Where to return when a flow the user opened themselves finishes. */
  #return: { depth: number; path: string } | null = null;

  get plexReady() {
    return account.ready;
  }
  get ganymedeReady() {
    return ganymede.phase === "ready" && (!!ganymede.user || ganymede.guest);
  }
  get booting() {
    return (
      account.phase === "starting" ||
      (account.phase === "connecting" && !account.resources.length && !account.connected.length) ||
      ganymede.phase === "checking"
    );
  }

  /** The setup screen that has to show right now, or null when the main app can. */
  get required(): SetupName | null {
    if (!this.picked) return "profiles";
    if (this.booting) return "starting";
    if (account.token && (account.phase === "choosingServer" || account.phase === "error" || account.phase === "connecting")) return "plex-servers";
    if (ganymede.phase === "ready" && !ganymede.user && !ganymede.guest) return "g-signin";
    if (!this.plexReady && !this.ganymedeReady) return "welcome";
    return null;
  }

  isSetup(name: Route["name"]): name is SetupName {
    return (SETUP as string[]).includes(name);
  }

  /** Whether `name` may show while `required` is in force. */
  allowed(name: Route["name"], required: SetupName) {
    return ((ALLOWED[required] ?? [required]) as string[]).includes(name);
  }

  /** Open a setup flow from inside the app; finish() comes back here. */
  open(route: Route) {
    if (!this.isSetup(router.current.route.name)) this.#return = { depth: router.depth, path: router.current.path };
    router.push(route);
  }

  /** A setup flow is done (or cancelled): go wherever makes sense next. */
  finish() {
    const req = this.required;
    if (req && !this.allowed(router.current.route.name, req)) return router.root(setupRoute(req));
    if (req) return; // still on an allowed setup screen
    const ret = this.#return;
    this.#return = null;
    // Still in history (the flow was pushed on top of it): go back to it. Otherwise (a gate
    // redirect replaced the history) open it again.
    if (ret && ret.depth < router.depth && router.stack[ret.depth]?.path === ret.path) return router.backTo(ret.depth);
    const target = ret?.path ?? this.pending ?? "/";
    this.pending = null;
    router.rootPath(target);
  }

  /** "Who's watching?" answered with the current profile. */
  keepProfile() {
    profiles.keep();
    this.picked = true;
    this.finish();
  }
}

export const gate = new Gate();
