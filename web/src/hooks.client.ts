// Every launch starts on the splash route while Plex and Ganymede connect. A deep link
// (e.g. #/plex/m1/item/42 after a reload) is kept and opened once setup is done.
import { gate } from "#lib/gate.svelte.ts";
import { parse } from "#lib/router.svelte.ts";

export function init() {
  const path = decodeURI(location.hash.replace(/^#/, "")) || "/";
  const route = parse(path);
  if (route.name === "starting") return;
  if (!gate.isSetup(route.name) && path !== "/") gate.pending = path;
  history.replaceState(history.state, "", `${location.pathname}${location.search}#/starting`);
}
