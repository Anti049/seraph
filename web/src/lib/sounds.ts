// Interface feedback sounds, synthesized with WebAudio (no audio files to ship or load).
// Deliberately short and quiet: they're heard hundreds of times a session.

import { settings } from "./settings.svelte";

export type Sound = "move" | "select" | "back" | "bump";

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let lastMove = 0;

function context(): Ctx | null {
  if (ctx) return ctx;
  const C = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** One enveloped tone gliding from f1 to f2 Hz. */
function tone(c: Ctx, f1: number, f2: number, ms: number, gain: number, type: OscillatorType, delay = 0) {
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f1, t0);
  osc.frequency.exponentialRampToValueAtTime(f2, t0 + ms / 1000);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + ms / 1000 + 0.02);
}

export function play(sound: Sound) {
  if (!settings.sounds) return;
  const c = context();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const v = settings.soundVolume; // 0..1
  switch (sound) {
    case "move": {
      // Holding a direction repeats fast; don't machine-gun the tick.
      const now = performance.now();
      if (now - lastMove < 55) return;
      lastMove = now;
      tone(c, 1500, 1150, 28, 0.035 * v, "sine");
      break;
    }
    case "select":
      tone(c, 660, 880, 55, 0.07 * v, "triangle");
      tone(c, 990, 1320, 70, 0.05 * v, "triangle", 0.045);
      break;
    case "back":
      tone(c, 880, 560, 70, 0.06 * v, "triangle");
      break;
    case "bump":
      tone(c, 210, 160, 70, 0.08 * v, "sine");
      break;
  }
}
