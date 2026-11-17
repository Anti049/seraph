// User preferences, stored on the TV.

export type Quality = "original" | "1080p-20" | "1080p-10" | "720p-4" | "480p-2";

export const QUALITIES: { id: Quality; label: string; bitrate?: number; resolution?: string }[] = [
  { id: "original", label: "Original (direct play when possible)" },
  { id: "1080p-20", label: "1080p · 20 Mbps", bitrate: 20000, resolution: "1920x1080" },
  { id: "1080p-10", label: "1080p · 10 Mbps", bitrate: 10000, resolution: "1920x1080" },
  { id: "720p-4", label: "720p · 4 Mbps", bitrate: 4000, resolution: "1280x720" },
  { id: "480p-2", label: "480p · 2 Mbps", bitrate: 2000, resolution: "720x480" },
];

import { getItem, setItem } from "./store";

const get = (k: string) => getItem(`sp:${k}`);
const put = (k: string, v: string) => setItem(`sp:${k}`, v);

export type SubEdge = "none" | "shadow" | "raised" | "depressed" | "outline";
export type SubPosition = "low" | "middle" | "high";
export type SubRendering = "styled" | "burn";

// Caption style options, the same set YouTube offers.
export const SUB_COLORS = [
  { id: "#FFFFFF", label: "White" },
  { id: "#FFFF00", label: "Yellow" },
  { id: "#00FF00", label: "Green" },
  { id: "#00FFFF", label: "Cyan" },
  { id: "#0000FF", label: "Blue" },
  { id: "#FF00FF", label: "Magenta" },
  { id: "#FF0000", label: "Red" },
  { id: "#000000", label: "Black" },
];
export const SUB_SCALES = [50, 75, 100, 150, 200, 300, 400];
export const SUB_OPACITIES = [0, 25, 50, 75, 100];
export const SUB_EDGES: { id: SubEdge; label: string }[] = [
  { id: "none", label: "None" },
  { id: "shadow", label: "Drop shadow" },
  { id: "raised", label: "Raised" },
  { id: "depressed", label: "Depressed" },
  { id: "outline", label: "Outline" },
];
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Captions saved before the YouTube-style options: map the old size/background presets.
const legacySize = { small: 75, medium: 100, large: 150, xl: 200 } as Record<string, number>;
const legacyBg = get("subBackground");

class Settings {
  quality = $state<Quality>((get("quality") as Quality) || "original");
  remoteQuality = $state<Quality>((get("remoteQuality") as Quality) || "1080p-10");
  autoplayNext = $state(get("autoplayNext") !== "0");
  autoSkipIntro = $state(get("autoSkipIntro") === "1");
  seekStep = $state(Number(get("seekStep")) || 10);
  sounds = $state(get("sounds") !== "0");
  soundVolume = $state(Number(get("soundVolume") ?? "") || 1);
  chatVisible = $state(get("chatVisible") !== "0");
  subFont = $state(get("subFont") || "System");
  subScale = $state(Number(get("subScale")) || legacySize[get("subSize") ?? ""] || 100);
  subColor = $state(get("subColor") || "#FFFFFF");
  subFontOpacity = $state(Number(get("subFontOpacity") ?? "") || 100);
  subBgColor = $state(get("subBgColor") || "#000000");
  subBgOpacity = $state(get("subBgOpacity") !== null ? Number(get("subBgOpacity")) : legacyBg === "solid" ? 100 : legacyBg === "box" ? 75 : legacyBg ? 0 : 75);
  subWindowColor = $state(get("subWindowColor") || "#000000");
  subWindowOpacity = $state(Number(get("subWindowOpacity") ?? "") || 0);
  subEdge = $state<SubEdge>((get("subEdge") as SubEdge) || (legacyBg === "outline" ? "outline" : legacyBg === "shadow" ? "shadow" : "none"));
  playbackSpeed = $state(1);
  subPosition = $state<SubPosition>((get("subPosition") as SubPosition) || "low");
  subRendering = $state<SubRendering>((get("subRendering") as SubRendering) || "styled");
  chatMode = $state<"side" | "overlay">((get("chatMode") as "side" | "overlay") || "side");
  chatSize = $state<"small" | "medium" | "large">((get("chatSize") as "small" | "medium" | "large") || "medium");

  set<
    K extends
      | "quality" | "remoteQuality" | "autoplayNext" | "autoSkipIntro" | "seekStep" | "chatVisible" | "chatMode" | "chatSize"
      | "sounds" | "soundVolume" | "subFont" | "subScale" | "subColor" | "subFontOpacity" | "subBgColor" | "subBgOpacity"
      | "subWindowColor" | "subWindowOpacity" | "subEdge" | "subPosition" | "subRendering",
  >(
    key: K,
    value: Settings[K],
  ) {
    (this as Settings)[key] = value;
    put(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }

  /** Back to YouTube's default caption look. */
  resetCaptions() {
    this.set("subFont", "System");
    this.set("subScale", 100);
    this.set("subColor", "#FFFFFF");
    this.set("subFontOpacity", 100);
    this.set("subBgColor", "#000000");
    this.set("subBgOpacity", 75);
    this.set("subWindowColor", "#000000");
    this.set("subWindowOpacity", 0);
    this.set("subEdge", "none");
  }
}

export const settings = new Settings();

/** "#RRGGBB" + opacity (0–100) → rgba(). */
export function rgba(hex: string, opacity: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity / 100})`;
}
