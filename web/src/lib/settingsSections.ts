// Settings sections, in rail order. Each one is a route: /settings/<id>.
import { account } from "./account.svelte";
import { libraries } from "./libraries.svelte";
import type { SettingsSection } from "./router.svelte";

export const SECTIONS: { id: SettingsSection; label: string; icon: string; show?: () => boolean }[] = [
  { id: "profiles", label: "Profiles", icon: "groups" },
  { id: "plex", label: "Plex", icon: "movie" },
  { id: "libraries", label: "Plex libraries", icon: "apps", show: () => account.ready && libraries.all.length > 0 },
  { id: "ganymede", label: "Ganymede", icon: "live" },
  { id: "quality", label: "Video quality", icon: "tune" },
  { id: "playback", label: "Playback", icon: "play" },
  { id: "captions", label: "Captions", icon: "closed-caption" },
  { id: "interface", label: "Interface", icon: "settings" },
  { id: "chat", label: "Chat replay", icon: "chat" },
  { id: "reports", label: "Error reports", icon: "flag" },
  { id: "updates", label: "Updates", icon: "restart" },
  { id: "about", label: "About", icon: "info" },
];

