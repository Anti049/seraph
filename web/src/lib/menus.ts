// Menu pages shared by the player (captions / settings buttons) and the details "More" menu.
import type { MenuItem, MenuPage } from "./components/MenuDrawer.svelte";
import { PLAYBACK_SPEEDS, QUALITIES, settings, SUB_COLORS, SUB_EDGES, SUB_OPACITIES, SUB_SCALES, type Quality } from "./settings.svelte";
import { SUBTITLE_FONTS } from "./fonts";
import type { Track } from "./playable";

/** A radio list: picking an option applies it and goes back to the previous page. */
function choices<T>(title: string, options: { value: T; label: string }[], current: T, pick: (v: T) => void, note?: string): MenuPage {
  return {
    title,
    note,
    items: options.map((o, i) => ({
      id: `${title}-${i}`,
      label: o.label,
      checked: o.value === current,
      action: () => {
        pick(o.value);
        return "back";
      },
    })),
  };
}

const colorLabel = (hex: string) => SUB_COLORS.find((c) => c.id.toLowerCase() === hex.toLowerCase())?.label ?? hex;
const pct = (n: number) => `${n}%`;

/** YouTube-style caption options. */
export function captionStylePage(): MenuPage {
  const color = (title: string, value: string, key: "subColor" | "subBgColor" | "subWindowColor"): MenuItem => ({
    id: key,
    label: title,
    detail: colorLabel(value),
    page: () =>
      choices(
        title,
        SUB_COLORS.map((c) => ({ value: c.id, label: c.label })),
        value,
        (v) => settings.set(key, v),
      ),
  });
  const opacity = (title: string, value: number, key: "subFontOpacity" | "subBgOpacity" | "subWindowOpacity", min = 0): MenuItem => ({
    id: key,
    label: title,
    detail: pct(value),
    page: () =>
      choices(
        title,
        SUB_OPACITIES.filter((o) => o >= min).map((o) => ({ value: o, label: pct(o) })),
        value,
        (v) => settings.set(key, v),
      ),
  });
  return {
    title: "Caption style",
    note: "Applies to text subtitles (SRT, ASS, WebVTT). Image subtitles are drawn by your Plex server.",
    items: [
      {
        id: "font",
        label: "Font family",
        detail: settings.subFont,
        page: () =>
          choices(
            "Font family",
            SUBTITLE_FONTS.map((f) => ({ value: f, label: f })),
            settings.subFont,
            (v) => settings.set("subFont", v),
            "Any Google Font can be typed in Settings → Subtitles.",
          ),
      },
      color("Font color", settings.subColor, "subColor"),
      {
        id: "size",
        label: "Font size",
        detail: pct(settings.subScale),
        page: () => choices("Font size", SUB_SCALES.map((s) => ({ value: s, label: pct(s) })), settings.subScale, (v) => settings.set("subScale", v)),
      },
      color("Background color", settings.subBgColor, "subBgColor"),
      opacity("Background opacity", settings.subBgOpacity, "subBgOpacity"),
      color("Window color", settings.subWindowColor, "subWindowColor"),
      opacity("Window opacity", settings.subWindowOpacity, "subWindowOpacity"),
      {
        id: "edge",
        label: "Character edge style",
        detail: SUB_EDGES.find((e) => e.id === settings.subEdge)?.label,
        page: () =>
          choices(
            "Character edge style",
            SUB_EDGES.map((e) => ({ value: e.id, label: e.label })),
            settings.subEdge,
            (v) => settings.set("subEdge", v),
          ),
      },
      opacity("Font opacity", settings.subFontOpacity, "subFontOpacity", 25),
      {
        id: "position",
        label: "Position",
        detail: { low: "Bottom", middle: "Raised", high: "High" }[settings.subPosition],
        page: () =>
          choices(
            "Position",
            [
              { value: "low" as const, label: "Bottom" },
              { value: "middle" as const, label: "Raised" },
              { value: "high" as const, label: "High" },
            ],
            settings.subPosition,
            (v) => settings.set("subPosition", v),
          ),
      },
      {
        id: "reset",
        label: "Reset to default",
        icon: "restart",
        action: () => {
          settings.resetCaptions();
          return "stay";
        },
      },
    ],
  };
}

/** Caption languages (with "Off"), then the style options at the bottom. */
export function captionsPage(tracks: Track[], choose: (t: Track | null) => void | Promise<void>): MenuPage {
  const off = !tracks.some((t) => t.selected);
  return {
    title: "Captions",
    items: [
      { id: "cc-off", label: "Off", checked: off, action: async () => void (await choose(null)) },
      ...tracks.map((t) => ({ id: `cc-${t.id}`, label: t.label, checked: t.selected, action: async () => void (await choose(t)) })),
      { id: "cc-style", label: "Options", icon: "tune", page: captionStylePage },
    ],
    note: tracks.length ? undefined : "This video has no subtitles.",
  };
}

export function audioPage(tracks: Track[], choose: (t: Track) => void | Promise<void>): MenuPage {
  return {
    title: "Audio track",
    items: tracks.map((t) => ({ id: `a-${t.id}`, label: t.label, checked: t.selected, action: async () => void (await choose(t)) })),
    note: tracks.length ? undefined : "Only one audio track.",
  };
}

export function qualityPage(current: Quality, choose: (q: Quality) => void, playing?: string): MenuPage {
  return {
    title: "Quality",
    items: QUALITIES.map((q) => ({ id: `q-${q.id}`, label: q.label, checked: q.id === current, action: () => choose(q.id) })),
    note: playing,
  };
}

export function speedPage(current: number, choose: (s: number) => void): MenuPage {
  return choices(
    "Playback speed",
    PLAYBACK_SPEEDS.map((s) => ({ value: s, label: s === 1 ? "Normal" : `${s}×` })),
    current,
    choose,
  );
}

export const speedLabel = (s: number) => (s === 1 ? "Normal" : `${s}×`);
export const qualityLabel = (q: Quality) => QUALITIES.find((x) => x.id === q)?.label.replace(/ \(.*\)$/, "") ?? q;
