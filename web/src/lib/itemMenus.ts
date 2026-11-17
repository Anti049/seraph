// The "More" menu on details screens, for Plex items and Ganymede videos.
import type { MenuItem, MenuPage } from "./components/MenuDrawer.svelte";
import { account, plexFor } from "./account.svelte";
import { episodeLabel, isWatched, watchlist, type Metadata, type Part } from "./plex";
import { api as gapi, ApiError, type Video } from "./ganymede/api";
import { gUrl } from "./ganymede/base";
import { ganymede } from "./ganymede/source.svelte";
import { router } from "./router.svelte";
import { settings } from "./settings.svelte";
import { audioPage, captionsPage, qualityPage } from "./menus";
import type { Track } from "./playable";

const denied = (e: unknown, what: string) =>
  e instanceof ApiError && (e.status === 401 || e.status === 403)
    ? new Error(`${what} needs more access: an editor/admin Ganymede account, or an API key with that scope (Settings → Ganymede).`)
    : (e as Error);

// ---------------------------------------------------------------- Plex

function plexTracks(m: Metadata, type: 2 | 3): Track[] {
  const part = m.Media?.[0]?.Part?.[0];
  return (part?.Stream ?? [])
    .filter((s) => s.streamType === type)
    .map((s) => ({ id: s.id, label: s.extendedDisplayTitle || s.displayTitle || s.language || `Track ${s.id}`, selected: !!s.selected }));
}

function plexFileInfo(m: Metadata): MenuPage {
  const facts: [string, string][] = [];
  m.Media?.forEach((media, i) => {
    const part = media.Part?.[0] as (Part & { file?: string; size?: number }) | undefined;
    const p = m.Media!.length > 1 ? `Version ${i + 1} · ` : "";
    facts.push([`${p}File`, part?.file?.split(/[\\/]/).pop() ?? ""]);
    if (part?.size) facts.push([`${p}Size`, `${(part.size / 1e9).toFixed(2)} GB`]);
    facts.push([`${p}Container`, (media.container ?? "").toUpperCase()]);
    facts.push([`${p}Video`, [media.videoCodec?.toUpperCase(), media.videoProfile, media.width && media.height ? `${media.width}×${media.height}` : media.videoResolution].filter(Boolean).join(" · ")]);
    facts.push([`${p}Bitrate`, media.bitrate ? `${(media.bitrate / 1000).toFixed(1)} Mb/s` : ""]);
    for (const s of part?.Stream ?? []) {
      if (s.streamType === 2) facts.push([`${p}Audio`, s.extendedDisplayTitle || s.displayTitle || ""]);
      if (s.streamType === 3) facts.push([`${p}Subtitle`, `${s.extendedDisplayTitle || s.displayTitle || ""}${s.key ? " (external)" : ""}`]);
    }
  });
  facts.push(["Library", m.librarySectionTitle ?? ""]);
  facts.push(["Server", plexFor(m).name]);
  return { title: "File info", facts: facts.filter(([, v]) => v) };
}

/** Plex "More" menu. `reload` refetches the item after a change. */
export function plexMoreMenu(m: Metadata, reload: () => Promise<void>): () => MenuPage {
  const s = plexFor(m);
  const watched = isWatched(m);
  const toggleWatched: MenuItem = {
    id: "watched",
    icon: watched ? "restart" : "check",
    label: watched ? "Mark as unwatched" : "Mark as watched",
    action: async () => {
      if (watched) await s.unscrobble(m.ratingKey);
      else await s.scrobble(m.ratingKey);
      await reload();
    },
  };
  const playable = m.type === "movie" || m.type === "episode";
  return () => ({
    title: m.title,
    items: [
      ...(playable
        ? [
            {
              id: "quality",
              icon: "tune",
              label: "Quality",
              detail: s.local ? "At home" : "Away",
              page: () =>
                qualityPage(s.local ? settings.quality : settings.remoteQuality, (q) => settings.set(s.local ? "quality" : "remoteQuality", q), "Used when you play from this TV."),
            } satisfies MenuItem,
            {
              id: "captions",
              icon: "closed-caption",
              label: "Captions",
              detail: plexTracks(m, 3).find((t) => t.selected)?.label ?? "Off",
              page: () =>
                captionsPage(plexTracks(m, 3), async (t) => {
                  await s.selectStreams(m.Media![0].Part[0].id, { subtitleStreamID: t?.id ?? 0 });
                  await reload();
                }),
            } satisfies MenuItem,
            {
              id: "audio",
              icon: "audio",
              label: "Audio track",
              detail: plexTracks(m, 2).find((t) => t.selected)?.label,
              disabled: plexTracks(m, 2).length < 2,
              page: () =>
                audioPage(plexTracks(m, 2), async (t) => {
                  await s.selectStreams(m.Media![0].Part[0].id, { audioStreamID: t.id });
                  await reload();
                }),
            } satisfies MenuItem,
          ]
        : []),
      {
        id: "watchlist",
        icon: "bookmark",
        label: "Add to Watchlist",
        disabled: !watchlist.id(m) || !account.token,
        page: (): MenuPage => ({
          title: "Watchlist",
          items: async () => {
            const on = await watchlist.has(account.token!, m);
            return [
              {
                id: "wl",
                icon: on ? "bookmark-added" : "bookmark",
                label: on ? "Remove from Watchlist" : "Add to Watchlist",
                action: async () => void (await watchlist.set(account.token!, m, !on)),
              },
            ];
          },
          note: "Your Plex Watchlist is shared with every Plex app.",
        }),
      },
      {
        id: "playlist",
        icon: "playlist-add",
        label: "Add to playlist or collection",
        page: (): MenuPage => ({
          title: "Add to…",
          items: async () => {
            const [playlists, collections] = await Promise.all([
              s.playlists().catch(() => [] as Metadata[]),
              m.librarySectionID || m.librarySectionKey ? s.collections(String(m.librarySectionID ?? m.librarySectionKey!.split("/").pop())).catch(() => [] as Metadata[]) : Promise.resolve([] as Metadata[]),
            ]);
            return [
              ...playlists.map((p) => ({
                id: `pl-${p.ratingKey}`,
                icon: "playlists",
                label: p.title,
                detail: "Playlist",
                action: async () => void (await s.addToPlaylist(p.ratingKey, m.ratingKey)),
              })),
              ...(m.type === "movie" || m.type === "show"
                ? collections.map((c) => ({
                    id: `col-${c.ratingKey}`,
                    icon: "collections",
                    label: c.title,
                    detail: "Collection",
                    action: async () => void (await s.addToCollection(c.ratingKey, m.ratingKey)),
                  }))
                : []),
            ];
          },
          note: "Create playlists and collections in Plex Web.",
        }),
      },
      ...(m.type === "episode" && m.grandparentRatingKey
        ? [
            {
              id: "show",
              icon: "tv",
              label: `Go to ${m.grandparentTitle ?? "show"}`,
              action: () => router.push({ name: "show", server: s.machineId, ratingKey: m.grandparentRatingKey! }),
            },
            {
              id: "season",
              icon: "video-library",
              label: `Go to ${m.parentTitle ?? `Season ${m.parentIndex}`}`,
              action: () => router.push({ name: "show", server: s.machineId, ratingKey: m.grandparentRatingKey!, season: m.parentRatingKey }),
            },
          ]
        : []),
      toggleWatched,
      {
        id: "manage",
        icon: "build",
        label: "Manage",
        page: (): MenuPage => ({
          title: "Manage",
          items: [
            { id: "refresh", icon: "refresh", label: "Refresh metadata", action: async () => void (await s.refresh(m.ratingKey)) },
            ...(playable ? [{ id: "analyze", icon: "stats", label: "Analyze file", action: async () => void (await s.analyze(m.ratingKey)) }] : []),
            {
              id: "web",
              icon: "open-in-new",
              label: "Open in Plex Web",
              page: () => ({ title: "Open in Plex Web", qr: { url: s.webUrl(m.ratingKey), caption: "Scan to open this item in Plex on your phone." } }),
            },
            {
              id: "delete",
              icon: "delete",
              label: "Delete…",
              danger: true,
              page: () => ({
                title: `Delete “${m.title}”?`,
                note: "This deletes the media file(s) from the server's disk. It can't be undone. Plex only allows it if “Allow media deletion” is on in the server settings.",
                items: [
                  { id: "cancel", label: "Cancel", action: () => "back" as const },
                  {
                    id: "confirm",
                    icon: "delete",
                    label: "Delete permanently",
                    danger: true,
                    action: async () => {
                      await s.remove(m.ratingKey);
                      router.back();
                    },
                  },
                ],
              }),
            },
          ],
          note: "Managing needs an owner or admin account on this server.",
        }),
      },
      ...(playable ? [{ id: "info", icon: "description", label: "File info", page: () => plexFileInfo(m) }] : []),
    ],
  });
}

// ---------------------------------------------------------------- Ganymede

export function ganymedeMoreMenu(v: Video, watched: boolean, toggleWatched: () => Promise<void>, reload: () => Promise<void>): () => MenuPage {
  const ch = v.edges?.channel;
  return () => ({
    title: v.title,
    items: [
      {
        id: "playlist",
        icon: "playlist-add",
        label: "Add to playlist",
        page: (): MenuPage => ({
          title: "Add to playlist",
          items: async () =>
            ((await gapi.playlists()) ?? []).map((p) => ({
              id: `gpl-${p.id}`,
              icon: "playlists",
              label: p.name,
              action: async () => {
                try {
                  await gapi.addToPlaylist(p.id, v.id);
                } catch (e) {
                  throw denied(e, "Adding to a playlist");
                }
              },
            })),
        }),
      },
      ...(ch ? [{ id: "channel", icon: "channels", label: `Go to ${ch.display_name}`, action: () => router.push({ name: "g-channel", id: ch.id, title: ch.display_name }) }] : []),
      ...(ganymede.user
        ? [{ id: "watched", icon: watched ? "restart" : "check", label: watched ? "Mark as unwatched" : "Mark as watched", action: toggleWatched }]
        : []),
      {
        id: "manage",
        icon: "build",
        label: "Manage",
        page: (): MenuPage => ({
          title: "Manage",
          items: [
            {
              id: "lock",
              icon: v.locked ? "lock-open" : "lock",
              label: v.locked ? "Unlock (allow automatic cleanup)" : "Lock (keep from automatic cleanup)",
              action: async () => {
                try {
                  await gapi.lock(v.id, !v.locked);
                  await reload();
                } catch (e) {
                  throw denied(e, "Locking");
                }
              },
            },
            {
              id: "thumbs",
              icon: "refresh",
              label: "Regenerate preview thumbnails",
              action: async () => {
                try {
                  await gapi.regenerateThumbnails(v.id);
                } catch (e) {
                  throw denied(e, "Regenerating thumbnails");
                }
              },
            },
            {
              id: "web",
              icon: "open-in-new",
              label: "Open in Ganymede",
              page: () => ({ title: "Open in Ganymede", qr: { url: `${gUrl()}/videos/${v.id}`, caption: "Scan to open this video in Ganymede's web app." } }),
            },
            {
              id: "delete",
              icon: "delete",
              label: "Delete…",
              danger: true,
              page: () => ({
                title: `Delete “${v.title}”?`,
                note: "Removes the video from Ganymede. Needs an admin account (or an API key with vod:admin).",
                items: [
                  { id: "cancel", label: "Cancel", action: () => "back" as const },
                  ...[false, true].map((files) => ({
                    id: files ? "files" : "entry",
                    icon: "delete",
                    label: files ? "Delete video and its files" : "Delete from Ganymede, keep files",
                    danger: true,
                    action: async () => {
                      try {
                        await gapi.remove(v.id, files);
                      } catch (e) {
                        throw denied(e, "Deleting");
                      }
                      router.back();
                    },
                  })),
                ],
              }),
            },
          ],
        }),
      },
      {
        id: "info",
        icon: "description",
        label: "File info",
        page: (): MenuPage => ({
          title: "File info",
          items: async () => [],
          facts: [
            ["Title", v.title],
            ["Type", v.type],
            ["Resolution", v.resolution],
            ["File", v.video_path?.split("/").pop() ?? ""],
            ["Chat", v.chat_path || v.live_chat_path ? "Available" : "None"],
            ["Locked", v.locked ? "Yes" : "No"],
          ].filter(([, x]) => x) as [string, string][],
          note: "Detailed codec info: Manage → Open in Ganymede.",
        }),
      },
    ],
  });
}

export { episodeLabel };
