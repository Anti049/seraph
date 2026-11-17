import { plexFor } from "./account.svelte";
import { episodeLabel, type Metadata } from "./plex";
import { media, type Video } from "./ganymede/api";
import { duration, relative } from "./format";

/** What the big backdrop at the top of Home shows, independent of source. */
export interface HeroData {
  key: string;
  art: string;
  eyebrow?: string;
  title: string;
  facts: string[];
  summary?: string;
}

export function heroFromPlex(m: Metadata): HeroData {
  const facts: string[] = [];
  if (m.type === "episode") facts.push(`${episodeLabel(m)} · ${m.title}`);
  if (m.year) facts.push(String(m.year));
  if (m.contentRating) facts.push(m.contentRating);
  if (m.duration && m.type !== "show") facts.push(duration(m.duration / 1000));
  if (m.type === "show" && m.childCount) facts.push(`${m.childCount} season${m.childCount === 1 ? "" : "s"}`);
  return {
    key: `p-${m.ratingKey}`,
    art: plexFor(m).image(m.art || m.grandparentArt || m.thumb, 1280, 720),
    title: m.type === "episode" ? (m.grandparentTitle ?? m.title) : m.title,
    facts,
    summary: m.summary,
  };
}

export function heroFromVideo(v: Video): HeroData {
  return {
    key: `g-${v.id}`,
    art: media(v.thumbnail_path || v.web_thumbnail_path),
    eyebrow: v.edges?.channel?.display_name,
    title: v.title,
    facts: [relative(v.streamed_at), duration(v.duration)].filter(Boolean),
  };
}
