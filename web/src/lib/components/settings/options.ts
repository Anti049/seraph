// Option lists shared by several settings pages.
import { QUALITIES, type Quality } from "../../settings.svelte";

export type Opt<V> = { v: V; l: string; style?: string; swatch?: string };

export const onOff: Opt<boolean>[] = [
  { v: true, l: "On" },
  { v: false, l: "Off" },
];
export const steps: Opt<number>[] = [5, 10, 15, 30].map((s) => ({ v: s, l: `${s}s` }));
export const qualities: Opt<Quality>[] = QUALITIES.map((q) => ({ v: q.id, l: q.id === "original" ? "Original" : q.label }));
export const volumes: Opt<number>[] = [
  { v: 0.5, l: "Quiet" },
  { v: 1, l: "Normal" },
  { v: 1.8, l: "Loud" },
];
export const chatSizes: Opt<"small" | "medium" | "large">[] = [
  { v: "small", l: "Small" },
  { v: "medium", l: "Medium" },
  { v: "large", l: "Large" },
];
