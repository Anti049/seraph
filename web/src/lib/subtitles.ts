// Subtitle files → timed cues. Handles SRT, WebVTT and ASS/SSA (styling tags stripped,
// since the viewer's own subtitle style is applied instead).

export interface Cue {
  start: number; // seconds
  end: number;
  text: string; // plain text, "\n" between lines
}

const TEXT_CODECS = ["srt", "subrip", "vtt", "webvtt", "ass", "ssa", "mov_text", "tx3g", "text", "smi", "sami"];
export const isTextSubtitle = (codec?: string) => TEXT_CODECS.includes((codec ?? "").toLowerCase());

function time(t: string): number {
  const m = /(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?/.exec(t.trim());
  if (!m) return NaN;
  const [, h, mi, s, ms] = m;
  return Number(h ?? 0) * 3600 + Number(mi) * 60 + Number(s) + Number((ms ?? "0").padEnd(3, "0")) / 1000;
}

export function cleanText(t: string): string {
  return t
    .replace(/\{[^}]*\}/g, "") // ASS override tags
    .replace(/\\N|\\n/g, "\n")
    .replace(/\\h/g, " ")
    .replace(/<[^>]+>/g, "") // HTML-ish / VTT tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseSrtVtt(src: string): Cue[] {
  const out: Cue[] = [];
  const blocks = src.replace(/\r/g, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const start = time(a);
    const end = time(b.trim().split(/\s+/)[0]);
    const text = cleanText(lines.slice(i + 1).join("\n"));
    if (!isNaN(start) && !isNaN(end) && text) out.push({ start, end, text });
  }
  return out;
}

function parseAss(src: string): Cue[] {
  const out: Cue[] = [];
  let fields: string[] = ["layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"];
  let inEvents = false;
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (/^\[.*\]$/.test(line)) {
      inEvents = /^\[events\]$/i.test(line);
      continue;
    }
    if (!inEvents) continue;
    if (/^format:/i.test(line)) {
      fields = line.slice(7).split(",").map((f) => f.trim().toLowerCase());
      continue;
    }
    if (!/^dialogue:/i.test(line)) continue;
    const parts = line.slice(9).split(",");
    const textIdx = fields.indexOf("text");
    const get = (name: string) => parts[fields.indexOf(name)]?.trim() ?? "";
    const text = cleanText(parts.slice(textIdx).join(","));
    const start = time(get("start"));
    const end = time(get("end"));
    if (!isNaN(start) && !isNaN(end) && text) out.push({ start, end, text });
  }
  return out;
}

export function parseSubtitles(src: string, codec?: string): Cue[] {
  const c = (codec ?? "").toLowerCase();
  const cues = c === "ass" || c === "ssa" || /^\s*\[script info\]/i.test(src) ? parseAss(src) : parseSrtVtt(src);
  return cues.sort((a, b) => a.start - b.start);
}

/** Cues showing at time t (cues are sorted by start). */
export function activeAt(cues: Cue[], t: number): string[] {
  // binary search the last cue starting at or before t, then walk back over overlaps
  let lo = 0;
  let hi = cues.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const out: string[] = [];
  for (let i = idx; i >= 0 && i > idx - 8; i--) if (cues[i].end > t) out.unshift(cues[i].text);
  return out;
}
