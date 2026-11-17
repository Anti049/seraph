<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { account } from "../account.svelte";
  import { playableFor, type NextUp, type Playable, type Rec, type Source, type TextSubs, type Track } from "../playable";
  import { activeAt, cleanText, parseSubtitles, type Cue } from "../subtitles";
  import SubtitleText from "../components/SubtitleText.svelte";
  import type { ChatLine, ChatReplay } from "../ganymede/chat";
  import { clock } from "../format";
  import { pushHandler, type InputEvent } from "../input";
  import { focusById, focusByIdSoon, focusFirst, focusFirstSoon } from "../nav";
  import { router } from "../router.svelte";
  import { QUALITIES, settings, type Quality } from "../settings.svelte";
  import { reporter } from "../report.svelte";
  import { audioPage, captionsPage, qualityLabel as qLabel, qualityPage, speedLabel, speedPage } from "../menus";
  import MenuDrawer, { type MenuPage } from "../components/MenuDrawer.svelte";
  import QrCode from "../components/QrCode.svelte";
  import { setScreenSaver } from "../platform";
  import Icon from "../components/Icon.svelte";
  import Spinner from "../components/Spinner.svelte";
  import Btn from "../components/Btn.svelte";

  let { source, id, offset = 0, server }: { source: Source; id: string; offset?: number; server?: string } = $props();

  // ---- state ----
  let el: HTMLVideoElement;
  let item = $state<Playable | null>(null);
  let error = $state<string | null>(null);
  let paused = $state(true);
  let buffering = $state(true);
  let current = $state(0);
  let total = $state(0);
  let bufferedEnd = $state(0);
  let osd = $state(true);
  // Side menus (captions / settings), built on demand.
  let menuOpen = $state(false);
  let menuRoot = $state<() => MenuPage>(() => ({ title: "" }));
  let stats = $state(false);
  let statsTick = $state(0);
  let speed = $state(1);
  let prevUp = $state<NextUp | null>(null);
  let recs = $state<Rec[]>([]);
  // Focus is in the recommendations shelf: the controls slide up to show it.
  let shelf = $state(false);
  let toast = $state<string | null>(null);
  let pendingSeek = $state<number | null>(null);
  let preview = $state<string | null>(null);
  let mode = $state<"direct" | "transcode">("direct");
  let local = $derived((account.connected.find((c) => c.machineId === server) ?? account.server)?.local ?? true);
  let quality = $state<Quality>(untrack(() => (local ? settings.quality : settings.remoteQuality)));
  let nextUp = $state<NextUp | null>(null);
  let upNextDismissed = $state(false);
  let countdown = $state<number | null>(null);
  let now = $state(new Date());
  let audio = $state<Track[]>([]);
  let subs = $state<Track[]>([]);
  // chat (Ganymede)
  let chatOn = $state(settings.chatVisible);
  let lines = $state<ChatLine[]>([]);
  let chat: ChatReplay | null = null;

  // styled subtitles (drawn by us instead of burned in by the server)
  let subLines = $state<string[]>([]);
  let cues: Cue[] = [];
  let subTimer: ReturnType<typeof setInterval> | undefined;
  let subFallback: ReturnType<typeof setTimeout> | undefined;
  let subGen = 0;

  let hls: { destroy(): void } | null = null;
  let held = 0;
  let lastReport = 0;
  let finishedSent = false;
  let restarting = true;
  let pendingStart = 0;
  let autoSkipped = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let seekTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let countdownTimer: ReturnType<typeof setInterval> | undefined;
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  let statsTimer: ReturnType<typeof setInterval> | undefined;
  let chatTimer: ReturnType<typeof setInterval> | undefined;

  // ---- derived ----
  let shownTime = $derived(pendingSeek ?? current);
  let markers = $derived(item?.markers ?? []);
  let chapters = $derived(item?.chapters ?? []);
  let chatAvailable = $derived(!!item?.hasChat);
  let showChat = $derived(chatAvailable && chatOn);
  let activeSkip = $derived(
    markers.find((m) => current >= m.start && current < m.end - 1.5 && (m.type === "intro" || (m.type === "credits" && !nextUp))) ?? null,
  );
  let currentChapter = $derived(chapters.find((c) => shownTime >= c.start && shownTime < c.end) ?? null);
  let creditsStart = $derived.by(() => {
    const c = markers.find((m) => m.type === "credits");
    if (c) return c.start;
    return total > 0 ? total - 25 : Infinity;
  });
  let showUpNext = $derived(!!nextUp && !upNextDismissed && total > 0 && current >= creditsStart);
  let pct = (t: number) => (total > 0 ? Math.min(100, Math.max(0, (t / total) * 100)) : 0);
  let endsAt = $derived.by(() => {
    if (!total) return "";
    const d = new Date(now.getTime() + Math.max(0, total - shownTime) * 1000);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  });

  // ---- lifecycle ----
  onMount(() => {
    const off = pushHandler(onInput);
    clockTimer = setInterval(() => (now = new Date()), 15000);
    load();
    return off;
  });

  async function load() {
    try {
      item = await playableFor(source, id, server);
    } catch (e) {
      error = (e as Error).message;
      buffering = false;
      return;
    }
    total = item.duration;
    audio = item.audio;
    subs = item.subtitles;
    await tick();
    await startStream(offset);
    showOsd("p-play");
    item.next().then((n) => (nextUp = n));
    item.previous().then((p) => (prevUp = p));
    item.recommended().then((r) => (recs = r)).catch(() => {});
    startChat();
  }

  async function startStream(at: number) {
    if (!item) return;
    error = null;
    buffering = true;
    restarting = true;
    pendingStart = at;
    hls?.destroy();
    hls = null;
    let info;
    try {
      info = await item.open(el, at, quality);
    } catch (e) {
      error = (e as Error).message;
      return;
    }
    mode = info.mode;
    setupSubs(info.subs);
    if (!info.hls || el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = info.url;
      return;
    }
    const { default: Hls } = await import("hls.js");
    if (!Hls.isSupported()) {
      error = "This TV can't play streamed video.";
      return;
    }
    // subtitleDisplay:false keeps WebVTT tracks "hidden": cues load, but we draw them ourselves.
    const h = new Hls({ maxBufferLength: 40, startPosition: at });
    h.subtitleDisplay = false;
    h.on(Hls.Events.ERROR, (_e: unknown, d: { fatal: boolean; details: string }) => {
      if (d.fatal) error = `Playback error (${d.details})`;
    });
    h.on(Hls.Events.MANIFEST_PARSED, () => {
      if (info.subs?.kind === "track" && h.subtitleTracks.length) h.subtitleTrack = 0;
    });
    h.loadSource(info.url);
    h.attachMedia(el);
    hls = h;
  }

  // ---- styled subtitles ----
  function setupSubs(subs: TextSubs | undefined) {
    const gen = ++subGen;
    clearInterval(subTimer);
    clearTimeout(subFallback);
    cues = [];
    subLines = [];
    if (!subs) return;
    if (subs.kind === "file") {
      fetch(subs.url)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((text) => {
          if (gen !== subGen) return;
          cues = parseSubtitles(text, subs.codec);
          if (!cues.length) throw new Error("empty");
          subTimer = setInterval(() => (subLines = activeAt(cues, el.currentTime)), 120);
        })
        .catch(() => gen === subGen && burnSubtitles());
      return;
    }
    // WebVTT cues arriving in the HLS stream (hls.js or the TV's native player)
    let seen = false;
    subTimer = setInterval(() => {
      const tracks = Array.from(el.textTracks ?? []).filter((t) => t.kind === "subtitles" || t.kind === "captions");
      if (!tracks.length) return;
      seen = true;
      const lines: string[] = [];
      for (const t of tracks) {
        if (t.mode === "disabled" || t.mode === "showing") t.mode = "hidden";
        for (const c of Array.from(t.activeCues ?? [])) {
          const txt = cleanText((c as VTTCue).text ?? "");
          if (txt) lines.push(txt);
        }
      }
      subLines = lines;
    }, 150);
    // If the stream never carries a subtitle track, let the server burn them in instead.
    subFallback = setTimeout(() => {
      if (gen === subGen && !seen && !paused) burnSubtitles();
    }, 15000);
  }

  function burnSubtitles() {
    if (!item) return;
    item.useBurnedSubtitles();
    flash("Styled subtitles unavailable for this file. Using the server's subtitles.", 5000);
    startStream(el.currentTime || pendingStart);
  }

  function onLoadedMetadata() {
    if (isFinite(el.duration) && el.duration > 0) total = el.duration;
    if (pendingStart > 0 && Math.abs(el.currentTime - pendingStart) > 2) el.currentTime = pendingStart;
    el.play().catch(() => (paused = true));
  }

  function onMediaError() {
    if (mode === "direct" && item?.supportsQuality) {
      quality = quality === "original" ? "1080p-20" : quality;
      flash("Switching to converted stream");
      startStream(el.currentTime || pendingStart);
      return;
    }
    error = el.error?.code === 4 ? "This TV can't play this video's format." : "Playback failed. The server may be busy or unreachable.";
    buffering = false;
  }

  // ---- chat ----
  async function startChat() {
    if (!item?.hasChat) return;
    chat = item.chat((l) => (lines = l));
    if (!chat) return;
    await chat.init();
    chatTimer = setInterval(() => {
      if (chatOn && chat && el && !el.paused) chat.tick(el.currentTime);
    }, 400);
  }

  function toggleChat() {
    if (!chatAvailable) return flash("No chat for this video");
    chatOn = !chatOn;
    if (chatOn && chat) chat.tick(el.currentTime);
    flash(chatOn ? "Chat on" : "Chat off");
  }

  // ---- reporting ----
  function report(state: "playing" | "paused" | "stopped") {
    if (!item || restarting) return;
    item.report(state, current, total);
  }

  function onTimeUpdate() {
    if (restarting) {
      if (pendingStart > 0 && el.currentTime < pendingStart - 3) return;
      restarting = false;
    }
    current = el.currentTime;
    if (el.buffered.length) bufferedEnd = el.buffered.end(el.buffered.length - 1);
    if (Math.abs(current - lastReport) >= 10) {
      lastReport = current;
      report(el.paused ? "paused" : "playing");
    }
    if (!finishedSent && total > 60 && current / total > 0.92) {
      finishedSent = true;
      item?.finished();
    }
    if (settings.autoSkipIntro && !autoSkipped && activeSkip?.type === "intro") {
      autoSkipped = true;
      skipMarker();
    }
    if (showUpNext && countdown === null && settings.autoplayNext && !paused) startCountdown();
  }

  // ---- controls ----
  function flash(msg: string, ms = 1600) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), ms);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!paused && !menuOpen && pendingSeek === null) hideOsd();
    }, 5000);
  }

  async function showOsd(focusId?: string) {
    const was = osd;
    osd = true;
    scheduleHide();
    if (!was || focusId) {
      await tick();
      if (!focusById(focusId ?? "p-play")) focusFirst();
    }
  }

  function hideOsd() {
    osd = false;
    shelf = false;
    if (!showUpNext && !activeSkip) (document.activeElement as HTMLElement | null)?.blur?.();
  }

  function togglePlay() {
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function seekBy(delta: number, repeat = false) {
    if (!total) return;
    held = repeat ? held + 1 : 0;
    const step = Math.abs(delta) * (held > 20 ? 12 : held > 10 ? 6 : held > 4 ? 3 : 1);
    const base = pendingSeek ?? el.currentTime;
    pendingSeek = Math.min(Math.max(0, base + Math.sign(delta) * step), Math.max(0, total - 2));
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      if (pendingSeek !== null && item) preview = item.previewFrame(pendingSeek);
    }, 120);
    if (!osd) {
      osd = true;
      tick().then(() => focusById("p-seek"));
    }
    scheduleHide();
    clearTimeout(seekTimer);
    seekTimer = setTimeout(commitSeek, repeat ? 450 : 700);
  }

  function commitSeek() {
    if (pendingSeek === null) return;
    seekTo(pendingSeek);
    held = 0;
    scheduleHide();
  }

  function seekTo(t: number) {
    pendingSeek = null;
    preview = null;
    el.currentTime = Math.max(0, t);
    current = el.currentTime;
    if (t < creditsStart) {
      upNextDismissed = false;
      cancelCountdown();
    }
  }

  function skipMarker() {
    const m = activeSkip;
    if (!m) return;
    seekTo(m.end);
    flash(m.type === "intro" ? "Intro skipped" : "Credits skipped");
  }

  function jumpChapter(dir: 1 | -1) {
    if (!chapters.length) return false;
    const t = el.currentTime;
    const target = dir > 0 ? chapters.find((c) => c.start > t + 1) : [...chapters].reverse().find((c) => c.start < t - 5);
    if (target) {
      seekTo(target.start);
      flash(target.title);
    } else if (dir < 0) seekTo(0);
    return true;
  }

  function startCountdown() {
    countdown = 10;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      if (countdown === null || paused) return;
      countdown -= 1;
      if (countdown <= 0) playNext();
    }, 1000);
    tick().then(() => focusById("p-upnext-play"));
  }

  function cancelCountdown() {
    clearInterval(countdownTimer);
    countdown = null;
  }

  function dismissUpNext() {
    cancelCountdown();
    upNextDismissed = true;
    showOsd("p-play");
  }

  function playNext() {
    if (!nextUp) return;
    cancelCountdown();
    router.replace(nextUp.route);
  }

  // ---- menus ----
  function openMenu(make: () => MenuPage) {
    menuRoot = make;
    menuOpen = true;
    osd = true;
    clearTimeout(hideTimer);
  }

  function menuClosed() {
    scheduleHide();
  }

  const subLabel = () => subs.find((s) => s.selected)?.label ?? "Off";
  const audioLabel = () => audio.find((s) => s.selected)?.label ?? "";

  function captionsMenu(): MenuPage {
    return captionsPage(subs, (t) => chooseTrack("subtitle", t));
  }

  function settingsMenu(): MenuPage {
    const plexish = !!item?.supportsQuality;
    return {
      title: "Settings",
      items: [
        ...(plexish
          ? [
              {
                id: "quality",
                icon: "tune",
                label: "Quality",
                detail: mode === "direct" ? "Original" : qLabel(quality),
                page: () => qualityPage(quality, chooseQuality, mode === "direct" ? "Now playing the original file." : "Now converted by your server."),
              },
            ]
          : []),
        { id: "captions", icon: "closed-caption", label: "Captions", detail: subLabel(), page: captionsMenu },
        ...(audio.length > 1
          ? [{ id: "audio", icon: "audio", label: "Audio track", detail: audioLabel(), page: () => audioPage(audio, (t) => chooseTrack("audio", t)) }]
          : []),
        { id: "speed", icon: "speed", label: "Playback speed", detail: speedLabel(speed), page: () => speedPage(speed, setSpeed) },
        {
          id: "autoplay",
          icon: "autoplay",
          label: "Autoplay next",
          toggle: settings.autoplayNext,
          action: () => {
            settings.set("autoplayNext", !settings.autoplayNext);
            return "stay" as const;
          },
        },
        ...(chapters.length
          ? [
              {
                id: "chapters",
                icon: "chapters",
                label: "Chapters",
                detail: currentChapter?.title,
                page: (): MenuPage => ({
                  title: "Chapters",
                  items: chapters.map((c) => ({
                    id: `ch-${c.id}`,
                    label: `${clock(c.start)}  ${c.title}`,
                    checked: currentChapter?.id === c.id,
                    action: () => seekTo(c.start),
                  })),
                }),
              },
            ]
          : []),
        {
          id: "report",
          icon: "flag",
          label: "Report a playback problem",
          action: () => {
            reporter.report(new Error(`Playback problem: ${item?.title ?? id} (${mode}, ${qLabel(quality)}, ${error ?? "no error"})`), "manual");
          },
        },
        {
          id: "feedback",
          icon: "feedback",
          label: "Send feedback",
          page: () => ({
            title: "Send feedback",
            qr: {
              url: `https://github.com/${reporter.repo}/issues/new?labels=feedback&title=${encodeURIComponent("Feedback: ")}`,
              caption: `Scan to open a feedback issue on GitHub (${reporter.repo}).`,
            },
          }),
        },
        {
          id: "stats",
          icon: "stats",
          label: "Stats for nerds",
          toggle: stats,
          action: () => {
            toggleStats();
            return "stay" as const;
          },
        },
      ],
    };
  }

  function setSpeed(s: number) {
    speed = s;
    el.playbackRate = s;
    flash(`Speed: ${speedLabel(s)}`);
  }

  function toggleStats() {
    stats = !stats;
    clearInterval(statsTimer);
    if (stats) statsTimer = setInterval(() => statsTick++, 1000);
  }

  let statRows = $derived.by(() => {
    statsTick;
    if (!stats || !el || !item) return [] as [string, string][];
    const q = (el as HTMLVideoElement & { getVideoPlaybackQuality?(): VideoPlaybackQuality }).getVideoPlaybackQuality?.();
    return [
      ["Source", `${source === "plex" ? "Plex" : "Ganymede"} · ${id}`],
      ["Playback", mode === "direct" ? "Direct play (original file)" : `Converted by server · ${qLabel(quality)}`],
      ["Current / optimal res", `${el.videoWidth}×${el.videoHeight} / ${innerWidth * devicePixelRatio}×${innerHeight * devicePixelRatio}`],
      ["Dropped frames", q ? `${q.droppedVideoFrames} of ${q.totalVideoFrames}` : "n/a"],
      ["Buffer health", `${Math.max(0, bufferedEnd - current).toFixed(1)} s`],
      ["Speed", speedLabel(speed)],
      ["Captions", subLabel()],
      ...(item.fileInfo ?? []),
    ] as [string, string][];
  });

  async function chooseTrack(kind: "audio" | "subtitle", t: Track | null) {
    if (!item) return;
    const at = el.currentTime;
    try {
      await item.selectTrack(kind, t ? t.id : null);
    } catch {
      flash("Couldn't change track");
      return;
    }
    audio = item.audio;
    subs = item.subtitles;
    flash(kind === "audio" ? `Audio: ${t?.label ?? ""}` : t ? `Captions: ${t.label}` : "Captions off");
    await tick();
    startStream(at);
  }

  function chooseQuality(q: Quality) {
    quality = q;
    if (local) settings.set("quality", q);
    else settings.set("remoteQuality", q);
    startStream(el.currentTime);
  }

  function playPrevious() {
    // Like YouTube: more than a few seconds in, "previous" restarts the video first.
    if (el.currentTime > 5 || !prevUp) {
      seekTo(0);
      return;
    }
    router.replace(prevUp.route);
  }

  function onInput(e: InputEvent): boolean {
    const a = e.action;
    if (menuOpen) return false; // the menu drawer handles its own keys
    switch (a) {
      case "playpause":
        togglePlay();
        showOsd();
        return true;
      case "play":
        el.play().catch(() => {});
        return true;
      case "pause":
        el.pause();
        return true;
      case "stop":
        router.back();
        return true;
      case "ff":
        seekBy(30, e.repeat);
        return true;
      case "rw":
        seekBy(-30, e.repeat);
        return true;
      case "next":
        if (nextUp) playNext();
        else jumpChapter(1);
        return true;
      case "prev":
        if (prevUp || !chapters.length) playPrevious();
        else jumpChapter(-1);
        return true;
      case "info":
        if (osd) hideOsd();
        else showOsd();
        return true;
      case "red":
        if (chatAvailable) toggleChat();
        else openMenu(captionsMenu);
        return true;
      case "green":
        openMenu(captionsMenu);
        return true;
    }

    if (showUpNext && !osd) {
      if (a === "back") {
        dismissUpNext();
        return true;
      }
      return false;
    }

    if (!osd) {
      switch (a) {
        case "ok":
          if (activeSkip) skipMarker();
          else {
            togglePlay();
            showOsd();
          }
          return true;
        case "left":
          seekBy(-settings.seekStep, e.repeat);
          return true;
        case "right":
          seekBy(settings.seekStep, e.repeat);
          return true;
        case "up":
          showOsd("p-seek");
          return true;
        case "down":
          if (activeSkip) {
            tick().then(() => focusById("p-skip"));
            return true;
          }
          showOsd("p-play");
          return true;
        case "back":
          return false;
      }
      return true;
    }

    scheduleHide();
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.focusId;
    if (focused === "p-seek") {
      if (a === "up") {
        // Up from the timeline (the top of the controls) tucks the controls away.
        if (pendingSeek !== null) commitSeek();
        hideOsd();
        return true;
      }
      if (a === "left" || a === "right") {
        seekBy(a === "left" ? -settings.seekStep : settings.seekStep, e.repeat);
        return true;
      }
      if (a === "ok") {
        if (pendingSeek !== null) commitSeek();
        else togglePlay();
        return true;
      }
    }
    if (a === "back") {
      if (pendingSeek !== null) {
        pendingSeek = null;
        preview = null;
        return true;
      }
      // Controls showing: Back just hides them (Back again leaves the player).
      hideOsd();
      return true;
    }
    return false;
  }

  function onPlay() {
    paused = false;
    setScreenSaver(false);
    report("playing");
    scheduleHide();
  }
  function onPause() {
    paused = true;
    setScreenSaver(true);
    report("paused");
    showOsd();
  }
  function onEnded() {
    paused = true;
    if (!finishedSent) item?.finished();
    finishedSent = true;
    if (nextUp && settings.autoplayNext && !upNextDismissed) playNext();
    else showOsd("p-play");
  }

  onDestroy(() => {
    [hideTimer, seekTimer, toastTimer, previewTimer].forEach(clearTimeout);
    [countdownTimer, clockTimer, chatTimer, subTimer, statsTimer].forEach(clearInterval);
    clearTimeout(subFallback);
    subGen++;
    chat?.destroy();
    setScreenSaver(true);
    restarting = false;
    if (item && current > 0) item.report("stopped", current, total);
    item?.close();
    hls?.destroy();
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
  });

</script>

{#snippet ctl(id: string, icon: string, label: string, onclick: () => void, opts: { big?: boolean; autofocus?: boolean; on?: boolean } = {})}
  <button
    class={[
      "grid flex-none place-items-center rounded-full text-on-surface transition duration-150 ease-tv focus:scale-110 focus:bg-on-surface focus:text-surface",
      opts.big ? "size-[5rem] bg-white/20" : "size-[3.9rem] bg-white/10",
      opts.on && "text-primary",
    ]}
    data-focus-id={id}
    data-autofocus={opts.autofocus ? "" : undefined}
    aria-label={label}
    title={label}
    {onclick}
  >
    <Icon name={icon} size={opts.big ? "2.6rem" : "2rem"} />
  </button>
{/snippet}

<!-- The player is its own lunar-ui scaffold: video in scaffold-body, chat docked as a sidebar
     (drawer-end column). Captions and settings open in a menu drawer. -->
<div class="scaffold fixed inset-0 z-50 bg-black" data-part="player" data-focus-trap>
  <div class="scaffold-body overflow-hidden">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      class="absolute inset-0 size-full bg-black"
      bind:this={el}
      poster={item?.poster || undefined}
      preload="auto"
      playsinline
      onloadedmetadata={onLoadedMetadata}
      ontimeupdate={onTimeUpdate}
      onplay={onPlay}
      onplaying={() => (buffering = false)}
      onpause={onPause}
      onwaiting={() => (buffering = true)}
      oncanplay={() => (buffering = false)}
      onseeked={() => (buffering = false)}
      onended={onEnded}
      onerror={onMediaError}
    ></video>

    {#if buffering && !error}
      <div class="absolute inset-0 grid place-items-center"><Spinner size="4.6rem" /></div>
    {/if}

    {#if error}
      <div class="absolute inset-0 z-7 grid content-center place-items-center gap-6 bg-black/60">
        <p class="max-w-208 text-center text-[1.4rem] text-error">{error}</p>
        <div class="flex gap-4" data-focus-group>
          {#if item}<Btn data-autofocus="" onclick={() => startStream(current)}>Try again</Btn>{/if}
          <Btn data-autofocus={item ? undefined : ""} onclick={() => router.back()}><Icon name="back" /> Back</Btn>
        </div>
      </div>
    {/if}

    {#if toast}
      <div class="surface-container-low elevation-2 absolute top-10 left-1/2 z-8 -translate-x-1/2 rounded-full px-6 py-2.5 font-semibold">{toast}</div>
    {/if}

    {#if stats}
      <div class="absolute top-8 left-8 z-8 w-[34rem] rounded-xl bg-black/75 p-5 font-mono text-[0.95rem] leading-relaxed" aria-label="Stats for nerds">
        <div class="mb-2 font-sans font-bold">Stats for nerds</div>
        {#each statRows as [k, v] (k)}
          <div class="flex gap-3"><span class="w-52 flex-none text-dim">{k}</span><span class="min-w-0 truncate">{v}</span></div>
        {/each}
      </div>
    {/if}

    <SubtitleText lines={subLines} raised={osd} />

    <!-- Controls: timeline, then details | transport | extra controls, then the recommendations shelf
         peeking at the bottom (it slides up when focus moves into it). -->
    <div
      class={["absolute inset-0 flex flex-col justify-end transition-opacity duration-250", osd ? "opacity-100" : "pointer-events-none opacity-0"]}
      data-part="osd"
      data-shown={osd ? "" : undefined}
    >
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-linear-to-t from-black/95 via-black/70 to-transparent"></div>
      <div class="absolute top-8 right-12 text-right">
        <div class="text-[1.8rem] font-semibold tabular-nums">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
        {#if endsAt}<div class="text-[1.05rem] text-subtext">Ends at {endsAt}</div>{/if}
      </div>

      <div class={["relative px-14 transition-transform duration-300 ease-tv", shelf ? "-translate-y-[13.5rem]" : "translate-y-0"]}>
        <!-- timeline -->
        <button class="group relative block w-full pt-3.5 text-left" data-focus-id="p-seek" aria-label="Timeline">
          {#if pendingSeek !== null}
            <div class="pointer-events-none absolute bottom-[3.6rem] flex -translate-x-1/2 flex-col items-center gap-1.5" style:left="{pct(pendingSeek)}%">
              {#if preview}<img class="h-[11.25rem] w-80 rounded-[0.6rem] border-[0.18rem] border-white bg-black object-cover" src={preview} alt="" />{/if}
              <span class="rounded-lg bg-black/75 px-3 py-0.5 text-[1.4rem] font-bold tabular-nums">{clock(pendingSeek)}</span>
            </div>
          {/if}
          <div class="relative h-2 rounded-[0.3rem] bg-white/20 transition-[height] duration-150 group-focus:h-[0.8rem]">
            <div class="absolute inset-y-0 left-0 rounded-[0.3rem] bg-white/25" style:width="{pct(bufferedEnd)}%"></div>
            {#each markers as m, i (i)}
              <div
                class="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.28)_0_0.3rem,rgb(255_255_255/0.08)_0.3rem_0.6rem)]"
                style:left="{pct(m.start)}%"
                style:width="{pct(m.end - m.start)}%"
              ></div>
            {/each}
            <div class="absolute inset-y-0 left-0 rounded-[0.3rem] bg-primary" style:width="{pct(shownTime)}%"></div>
            {#each chapters as c (c.id)}
              {#if c.start > 0}<div class="absolute inset-y-0 -ml-[0.11rem] w-[0.22rem] bg-black/75" style:left="{pct(c.start)}%"></div>{/if}
            {/each}
            <div
              class="absolute top-1/2 -mt-[0.8rem] -ml-1 h-[1.6rem] w-2 rounded-[0.3rem] bg-white opacity-0 transition-opacity duration-150 group-focus:opacity-100"
              style:left="{pct(shownTime)}%"
            ></div>
          </div>
          <div class="mt-3 flex justify-between gap-6 text-[1.15rem] text-on-surface tabular-nums">
            <span>{clock(shownTime)} / {clock(total)}</span>
            {#if currentChapter}<span class="flex-1 truncate text-center text-on-surface-variant">{currentChapter.title}</span>{/if}
            <span>−{clock(Math.max(0, total - shownTime))}</span>
          </div>
        </button>

        <!-- details | transport | extras -->
        <div class="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-8" data-part="controls" data-focus-group>
          <div class="min-w-0">
            {#if item?.details.eyebrow}<div class="truncate text-[1.1rem] font-bold text-primary">{item.details.eyebrow}</div>{/if}
            <div class="truncate text-[1.9rem] leading-tight font-extrabold">{item?.details.title ?? ""}</div>
            {#if item?.details.meta}<div class="mt-0.5 truncate text-[1.1rem] text-subtext">{item.details.meta}</div>{/if}
          </div>
          <div class="flex items-center gap-5">
            {@render ctl("p-prev", "prev", prevUp ? `Previous: ${prevUp.title}` : "Restart", playPrevious)}
            {@render ctl("p-play", paused ? "play" : "pause", paused ? "Play" : "Pause", togglePlay, { big: true, autofocus: true })}
            {@render ctl("p-next", "next", nextUp ? `Next: ${nextUp.title}` : "Next chapter", () => (nextUp ? playNext() : jumpChapter(1)))}
          </div>
          <div class="flex items-center justify-end gap-4">
            {#if chatAvailable}
              {@render ctl("p-chat", chatOn ? "chat" : "chatOff", chatOn ? "Hide chat" : "Show chat", toggleChat, { on: chatOn })}
            {/if}
            {#if subs.length || item?.supportsQuality}
              {@render ctl("p-cc", subs.some((s) => s.selected) ? "closed-caption" : "subtitles-off", "Captions", () => openMenu(captionsMenu), {
                on: subs.some((s) => s.selected),
              })}
            {/if}
            {@render ctl("p-settings", "settings", "Settings", () => openMenu(settingsMenu))}
          </div>
        </div>

        <!-- recommendations shelf -->
        <section
          class="mt-7 h-[13.5rem]"
          aria-label="Up next"
          onfocusin={() => (shelf = true)}
          onfocusout={(e) => (shelf = !!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)))}
        >
          {#if recs.length}
            <h3 class="mb-2 text-[1.1rem] font-bold text-subtext">{item?.source === "ganymede" ? "More from this channel" : nextUp ? "Up next" : "Recommended"}</h3>
            <div class="-mx-3 flex gap-5 overflow-hidden px-3 py-2" data-scroll-x data-focus-group>
              {#each recs as r (r.key)}
                <button
                  class="group w-[17rem] flex-none origin-top text-left transition duration-150 ease-tv focus:scale-105"
                  data-focus-id="rec-{r.key}"
                  onclick={() => router.replace(r.route)}
                >
                  <div class="relative overflow-hidden rounded-lg bg-surface-container pt-[56.25%] group-focus:shadow-ring">
                    {#if r.thumb}<img class="absolute inset-0 size-full object-cover" src={r.thumb} alt="" loading="lazy" />{/if}
                    {#if r.progress > 0}
                      <div class="absolute inset-x-0 bottom-0 h-[0.3rem] bg-white/25"><div class="h-full bg-primary" style:width="{r.progress * 100}%"></div></div>
                    {/if}
                  </div>
                  <div class="mt-1.5 truncate text-[1rem] font-semibold">{r.title}</div>
                  <div class="truncate text-[0.9rem] text-on-surface-variant">{r.sub}</div>
                </button>
              {/each}
            </div>
          {/if}
        </section>
      </div>
    </div>

    {#if activeSkip && !showUpNext}
      <button
        class={[
          "absolute right-14 z-4 inline-flex h-[3.6rem] items-center gap-3 rounded-[0.9rem] border-[0.12rem] border-white/35 bg-[rgb(24_24_37/0.85)] px-[1.6rem] text-[1.15rem] font-bold transition-[bottom] duration-200 focus:bg-white focus:text-black",
          osd ? "bottom-[29rem]" : "bottom-16",
        ]}
        data-focus-id="p-skip"
        onclick={skipMarker}
      >
        <Icon name="skip" size="1.6rem" />
        {activeSkip.type === "intro" ? "Skip intro" : "Skip credits"}
      </button>
    {/if}

    {#if showUpNext && nextUp}
      <div
        class={[
          "surface-container-low elevation-3 absolute right-14 z-6 flex w-208 gap-[1.4rem] rounded-[1.2rem] p-5 transition-[bottom] duration-200",
          osd ? "bottom-[29rem]" : "bottom-16",
        ]}
      >
        <img class="h-36 w-64 flex-none rounded-[0.6rem] object-cover" src={nextUp.thumb} alt="" />
        <div class="flex min-w-0 flex-col justify-between">
          <div class="text-[0.95rem] font-bold tracking-[0.06em] text-primary uppercase">Up next{countdown !== null ? ` in ${countdown}` : ""}</div>
          <div class="truncate text-[1.3rem] font-semibold">{nextUp.label} · {nextUp.title}</div>
          <div class="flex gap-4" data-focus-group>
            <Btn variant="filled" data-focus-id="p-upnext-play" onclick={playNext}><Icon name="play" /> Play now</Btn>
            <Btn data-focus-id="p-upnext-cancel" onclick={dismissUpNext}>Keep watching</Btn>
          </div>
        </div>
      </div>
    {/if}
  </div>
  {#if showChat}
    {@const overlay = settings.chatMode === "overlay"}
    <aside
      class={[
        "flex flex-col overflow-hidden",
        overlay
          ? "absolute top-32 right-6 bottom-52 z-2 w-96 bg-[linear-gradient(90deg,rgb(0_0_0/0),rgb(0_0_0/0.55)_15%)] [-webkit-mask-image:linear-gradient(180deg,transparent,#000_18%)] [mask-image:linear-gradient(180deg,transparent,#000_18%)]"
          : "sidebar drawer-end rounded-none [--sidebar-width:26rem]",
      ]}
      data-open={overlay ? undefined : ""}
      aria-label="Chat replay"
    >
      <div
        class={[
          "flex flex-1 flex-col justify-end overflow-hidden px-5 pt-4 pb-[1.4rem]",
          { small: "text-[0.95rem]", medium: "text-[1.12rem]", large: "text-[1.35rem]" }[settings.chatSize],
        ]}
      >
        {#each lines as l (l.id)}
          <div
            data-part="chat-line"
            class={[
              "flex-none px-[0.3em] py-[0.2em] leading-normal wrap-anywhere text-on-surface",
              overlay && "[text-shadow:0_0_0.3rem_#000,0_0_0.3rem_#000]",
              (l.kind === "notice" || l.kind === "first" || l.kind === "bits") && "rounded-[0.3rem] border-l-[0.25rem] border-primary bg-primary-container/40",
            ]}
          >
            {#if l.kind === "system"}
              <span class="text-dim italic">{l.fragments[0]?.t === "text" ? l.fragments[0].text : ""}</span>
            {:else}
              {#each l.badges as b (b.url)}<img class="mr-[0.25em] inline-block size-[1.15em] align-[-0.2em]" src={b.url} alt={b.title} />{/each}<span
                class="font-bold"
                style:color={l.color}>{l.name}</span
              >{#if l.kind !== "action"}<span class="mr-[0.3em]">:</span>{:else}<span class="mr-[0.3em]"></span>{/if}{#each l.fragments as f, i (i)}{#if f.t === "emote"}<img
                    class="-mx-[0.05em] -my-[0.35em] inline-block h-[1.75em] w-auto align-middle"
                    src={f.url}
                    alt={f.name}
                  />{:else}<span class={l.kind === "action" ? "italic" : ""}>{f.text}</span>{/if}{/each}
            {/if}
          </div>
        {/each}
      </div>
    </aside>
  {/if}


  <MenuDrawer root={menuRoot} bind:open={menuOpen} onclose={menuClosed} />
</div>
