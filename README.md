# SERAPH

A TV-first client for **Plex Media Server** and **[Ganymede](https://github.com/Zibbp/ganymede)** (archived Twitch
streams), for **Android TV / Google TV** and **Samsung Tizen TVs**. It's a web app (Svelte 5) packaged into
both TV apps (SvelteKit 3 + Tailwind CSS 4 + [lunar-ui](https://github.com/Anti049/lunar-ui-monorepo)). Each source is optional: add Plex, Ganymede, or both.

- **One Home screen** combining both: Continue watching (Plex), Continue watching streams and Recent streams
  (Ganymede), then your Plex shelves.
- **Separate library sections** in the side menu: *Plex* (your movie and TV libraries) and *Ganymede* (Channels, Playlists).
- **Search** across both.
- **One player** whose features depend on the source: Plex videos get audio/subtitles/quality,
  Skip Intro and Up Next; Ganymede videos get chat replay, beside or over the video. Both get chapters,
  resume and D-pad scrubbing.

The interface uses **Catppuccin Mocha mapped onto Material 3 colour roles** (Mauve primary), the same scheme as Noctua,
via lunar-ui's `catppuccin-mocha` theme (`<html data-theme>` in `web/src/app.html`), and is built from lunar-ui's own classes:

| Part of SERAPH | lunar-ui |
|---|---|
| App shell | `scaffold` (+ `tv-scaffold` sizing), screens in `scaffold-body` |
| Side menu | `sidebar-rail` → `sidebar` while focused, `sidebar-item` / `sidebar-label`, `elevation-3` when open |
| Page headers | `appbar`, `appbar-body`, `appbar-title`, `appbar-subtitle`, `appbar-trailing` (`PageHeader.svelte`) |
| Player | its own `scaffold`; docked chat is a `sidebar drawer-end`; audio/quality/chapters slide in as `drawer drawer-end` over a `drawer-scrim` |
| Buttons | lunar-ui-svelte `<Button>` (`Btn.svelte`) |
| Counters, tags, queue states | `badge` + `badge-filled` / `badge-tonal` + colour (`badge-primary`, `badge-error`, `badge-surface`…) |
| Dialogs, toasts, panels | `scrim`, `surface-container*` / `*-container` role classes, `elevation-*` |

lunar-ui sizes things in pt for desktop; `web/src/routes/layout.css` sets its knobs to 10-foot values
(`--sidebar-rail-width`, `--sidebar-width`, `--sidebar-icon-size`, `tv-appbar`, `tv-badge`, `btn`). Not used on TV:
`swap` (needs a checkbox and `:has()`), `tooltip`, `interactive`/ripple (pointer-oriented), `table`.
Type is **Inter**, bundled in the app. The logo is `art/seraph-logo.svg` (`tools/make_art.py` renders the launcher art from it).
D-pad navigation plays short **menu sounds**, synthesized with WebAudio and silent during playback; they can be turned off in Settings.

- **Error reports to GitHub.** When something breaks (an uncaught error, a screen that fails to render, or a crash the
  Android shell recorded), SERAPH shows what happened and a **QR code that opens a pre-filled GitHub issue** on your phone.
  Reports are scrubbed of tokens, API keys, server addresses and IPs. Optionally, paste a fine-grained GitHub token in
  Settings → Error reports to have reports **filed automatically**; repeats of the same error become comments on the
  existing issue. The token is stored on the TV only, never in the app.
- **Update notices** from the repository's latest GitHub release (checked at most daily; Settings → Updates has a QR code to the release).
- **Offline banner**, with sources reconnecting by themselves when the network comes back.
- **Instant Back**: library reads are cached briefly (any write such as playback progress clears the cache).
- Settings → About lists the app/engine versions, connection types and recent problems on this TV.

*SERAPH is an independent project. It isn't affiliated with Plex Inc. and doesn't use Plex's branding.*

## Plex features

- **Sign in like other TV apps:** the TV shows a 4-character code; you enter it at plex.tv/link.
- **Automatic connection:** probes each of your server's addresses and uses the best one (LAN, then remote, then relay). It remembers the server and reconnects on launch.
- **Home:** a backdrop hero that follows your focus, Continue Watching, and the shelves your server provides (recently added, and so on).
- **Libraries:** grids with sort options; shows → seasons → episodes with watched and progress state.
- **Your side menu:** in Settings → Plex libraries, choose which libraries appear, reorder them, and pick an icon for each
  from a list. **All libraries** in the menu always lists every library, hidden ones included. Saved per Plex server.
- **Details pages:** resume / start over, mark watched, cast and genres, "More like this".
- **Search:** across movies, shows and episodes.
- **Player:**
  - **Direct play** when the TV can decode the file. Otherwise, or when you pick a lower quality or turn on subtitles, it uses Plex's **transcoder** (HLS).
  - **Audio & subtitles** panel.
  - **Styled subtitles:** text subtitles (SRT, ASS/SSA, WebVTT…) are drawn by the app with your font (any Google Font),
    size, colour, background and position (Settings → Subtitles, with a live preview). External subtitle files are
    downloaded and parsed directly, so the video can still play without conversion. Embedded text subtitles are requested from the transcoder as
    WebVTT; if a file doesn't deliver them, the player switches to burned-in subtitles automatically. Image subtitles (PGS,
    VobSub) are always burned in by the server.
  - **Quality** presets, with separate defaults for home and away.
  - Timeline with **scrub preview frames** (from Plex's "video preview thumbnails") and shaded intro/credits sections.
  - **Skip intro / Skip credits** (optionally automatic), plus an **Up Next** card with a 10-second autoplay countdown.
  - The current time and "Ends at", D-pad scrubbing that speeds up when held, and media-key support.
- **Plex stays in sync:** playback position goes to `/:/timeline`, and finished items are scrobbled, so On Deck and Continue Watching match Plex's own apps.

## Ganymede features

- Channels (filter by Streams / Highlights / Clips / Uploads, sort by date or views), playlists, and stream details with chapters.
- Chat replay with emotes and badges, which you can hide. Choose beside or over the video and the text size in Settings.
- Recordings still in progress play via HLS.
- **Connecting:** the setup screen offers **Use the default** (`https://ganymede.nploetz.dev`, change with
  `GANYMEDE_DEFAULT=…` at build time), **Scan for local servers**, or typing an address. Local addresses such as
  `192.168.1.10:4800` or `tower.local:4800` try plain http first; public names try https first.
- **Network scan:** checks ports 4800 (Ganymede's docker-compose default), 4000, 80 and 8080 on every host of the
  TV's /24 and recognises Ganymede by its API's `{success, data}` response. On Android TV the native app runs the scan.
  On Samsung the TV's IP address comes from Samsung's `webapis`. In a desktop browser you type the subnet.
- **Queue tab:** live view of Ganymede's archive queue (queued / running / finalizing / failed), each job's task
  steps, and **Retry** for a failed task. Needs an account with the Archiver role or higher, or an API key with queue
  scopes (Settings → Ganymede → API key). The key also works on Samsung, where the login cookie doesn't.
- **Watch progress:**
  - **Android TV:** once you connect Ganymede, the app moves itself onto your Ganymede address
    (`https://<ganymede>/tv/`). Every `/tv/*` request is answered from the APK and never reaches your server,
    so Ganymede's `SameSite=Lax` login cookie is first-party and progress syncs normally. Plex logins are saved in the app's own
    storage, so moving the UI to the Ganymede address doesn't lose them. Nothing needs to be hosted on the server.
  - **Samsung:** the widget runs from local files, so the TV most likely won't send the cookie. SERAPH notices this
    after you sign in and keeps Ganymede progress on the TV (Settings shows which mode is active). To sync on Samsung too,
    add this in your Ganymede fork's `internal/transport/http/handler.go`, after `sessionManager = scs.New()`:
    ```go
    sessionManager.Cookie.SameSite = http.SameSiteNoneMode
    sessionManager.Cookie.Secure = true
    ```
  - Browsing and playback never need a login, because Ganymede's library endpoints are public.

## Test it on your computer

```bash
cd web && bun install
bun run dev          # http://localhost:5173 — add your real Plex account and/or Ganymede server
```

Arrow keys, Enter and Esc act as the remote, and Space plays and pauses. Set Chrome's device toolbar to
1920×1080 for a TV-sized view. Two caveats for desktop Chrome:
- Videos in H.264/AAC play directly. Anything else goes through your server's transcoder, so the result depends on that.
- `localhost` is plain http, so if your server only offers https `plex.direct` addresses, those are used. They work fine.

**Without real servers.** The mocks are a fake plex.tv + Plex Media Server (movies, shows, markers, multiple tracks,
HLS) and a fake Ganymede (channels, chapters, chat, cookie login):

```bash
tools/make_mock_media.sh                  # once; needs ffmpeg
# point "Use the default" at the mock so tests never touch the real server:
cd web && GANYMEDE_DEFAULT=http://localhost:4000 bun run build && bun run mock   # then open:
# http://localhost:4100/?plextv=http://localhost:4100     (Plex link code is approved after ~4 s)
#   add Ganymede with address  http://localhost:4000  and log in as nicolas / hunter2
# http://localhost:4000/tv/?plextv=http://localhost:4100  (same app on Ganymede's origin, like the Android app)
python3 ../test/merged.py                 # scripted run: add both sources, play both, search  → /tmp/mq2
python3 ../test/drive.py                  # Plex-only run: skip intro, tracks, transcode, up next → /tmp/mq
python3 ../test/features.py               # sounds, LAN/scan, queue, library menu, styled subtitles → /tmp/sp
python3 ../test/reporting.py              # error reports (QR, redaction, auto-filing), updates, offline, Back cache
```

Other checks: `bun run check` (svelte-check / TypeScript).

**Where reports go.** Error reports and update checks use the repository set at build time
(`SERAPH_REPO=owner/repo bun run build`, default `Anti049/seraph`; the Android shell's native fallback screen uses
`./gradlew assembleRelease -PseraphRepo=owner/repo`). It can also be changed per TV in Settings → Error reports.
Create a `crash-report` label in the repo so filed issues are tagged.

**Old TV engines.** Samsung's 2021 TVs (Tizen 6) run Chromium 76. Tailwind 4 targets Chrome 111+, so the build lowers its
CSS (`web/tools/legacy-css.ts`: cascade layers, `:where()`/`:is()`, logical properties, standalone transforms, lunar-ui's
oklch palettes; lunar-ui's `:has()` rules get attribute-based fallbacks) and `web/src/app.html` polyfills the few built-ins the Svelte runtime uses (`replaceAll`, `Object.hasOwn`, `at`).

## Android TV / Google TV

```bash
(cd web && bun install && bun run build)   # the APK bundles web/build (a single index.html)
cd android && ./gradlew assembleRelease     # → app/build/outputs/apk/release/app-release.apk
# your own signing key:  -Pkeystore=ks.jks -PkeystorePassword=… -PkeyAlias=… -PkeyPassword=…
adb connect <tv-ip> && adb install -r app/build/outputs/apk/release/app-release.apk
```

The UI is served out of the APK, from a private `https://appassets.androidplatform.net` origin, or from
`https://<ganymede>/tv/` once Ganymede is connected (see above). Plain-http LAN server addresses are allowed as
a fallback. To try it without a TV, use the Android Studio *Television (1080p)* emulator image.

## Samsung Tizen TV

1. Turn on Developer Mode on the TV: open *Apps*, press `1 2 3 4 5`, switch it **On**, enter your PC's IP, and restart the TV.
2. Install [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) (the CLI is enough) with **TV Extensions** and the **Samsung Certificate Extension**.
3. Create a *Samsung* TV certificate profile named `seraph` that includes your TV's DUID. Older TVs may accept a plain Tizen certificate.
4. Build and install:
   ```bash
   TIZEN_PROFILE=seraph ./tizen/build.sh
   sdb connect <tv-ip>
   tizen install -n tizen/build/SERAPH.wgt -t $(sdb devices | awk 'NR==2{print $3}')
   ```

## Remote controls

| Where | Button | Does |
|---|---|---|
| Everywhere | ◀ ▲ ▶ ▼ / OK / Back | Move, select, go back. Back on Home twice exits |
| Player | OK / ▶❚❚ | Play/pause, or skip the intro when the Skip button is showing |
| | ◀ ▶ (hold to speed up) | Scrub with preview frames. Release, or wait, to jump |
| | ▲ / ▼ | Show controls (▼ goes to Skip when it's showing) |
| | ⏪ ⏩ / ⏭ | ±30 s / next episode |
| | Red (or CC on Android) | Ganymede: show/hide chat · Plex: audio & subtitles |
| | Green | Plex: audio & subtitles |
| | ⏮ / ⏭ (Ganymede) | Previous / next chapter |
| | ▲ on the timeline | Hide the controls |
| | Back | Hide controls, then leave the player |

## Notes

- **Remote streaming and Plex Pass:** Plex is phasing in a requirement for **Plex Pass or Remote Watch Pass** to stream personal media
  away from home, on its own TV apps and on third-party clients using its API (2026 rollout).
  Streaming on your home network isn't affected. If you or the server owner has Plex Pass, remote streaming works.
- **API:** follows the official Plex Media Server API docs at https://developer.plex.tv/pms/. All `X-Plex-*` values are sent as query
  parameters, which the docs allow, so requests avoid CORS preflights from the Tizen widget's `file://` origin.
- **Transcoding** identifies itself as a Chrome-class client (`X-Plex-Platform=Chrome`), so the server produces H.264/AAC HLS,
  which both TV platforms play.

## Layout

```
web/       SvelteKit 3 + Tailwind 4 + lunar-ui (static, hash-routed, everything inlined into build/index.html)
             src/routes/                one route per screen (#/plex/item/123, #/play/ganymede/abc?t=90…) + the root layout
             src/lib/views/             the screens          src/lib/components/   shared pieces (cards, rows, Btn, QR…)
             src/lib/plex.ts            Plex API client      src/lib/ganymede/     Ganymede API, chat replay, sign-in/progress
             src/lib/playable.ts        source adapters for the shared player (src/lib/views/Player.svelte)
             src/lib/router.svelte.ts   navigation + focus restore on Back
             src/lib/report.svelte.ts   GitHub error reports     src/lib/updates.svelte.ts   release check
art/       seraph-logo.svg
android/   Kotlin WebView shell (~220 KB APK)
tizen/     config.xml + build.sh for the Samsung widget
mock/      mock plex.tv + Plex Media Server, mock Ganymede (bun run mock/all.ts)
test/      Playwright remote-control scripts (drive, merged, features, reporting)
tools/     launcher art + mock media generators
```
