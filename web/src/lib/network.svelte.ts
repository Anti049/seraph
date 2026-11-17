// Online/offline state. When the connection comes back, sources that dropped out reconnect
// on their own instead of waiting for the user to dig through Settings.
import { account } from "./account.svelte";
import { ganymede } from "./ganymede/source.svelte";
import { invalidatePlex } from "./plex";
import { invalidateGanymede } from "./ganymede/api";

class Network {
  online = $state(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  /** Briefly true after reconnecting, for the "Back online" toast. */
  restored = $state(false);
  #timer: ReturnType<typeof setTimeout> | undefined;

  install() {
    window.addEventListener("offline", () => (this.online = false));
    window.addEventListener("online", () => {
      this.online = true;
      this.restored = true;
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => (this.restored = false), 3000);
      invalidatePlex();
      invalidateGanymede();
      if (ganymede.phase === "offline") void ganymede.start();
      if (account.token && account.phase === "error") void account.start();
    });
  }
}

export const network = new Network();
