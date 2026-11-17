<script lang="ts">
  // App shell: remote input, Back, setup gating and the dialogs that can appear over any screen.
  // Screens themselves are routes: (setup)/… for full-screen setup, (app)/… for the main UI
  // (side rail + content) and play/… for the player.
  import "./layout.css";
  import { onMount, tick, untrack } from "svelte";
  import { installInput, setFallback } from "#lib/input.ts";
  import { activate, focusById, focusFirst, move } from "#lib/nav.ts";
  import { exitApp, registerPlatformKeys } from "#lib/platform.ts";
  import { router, setupRoute } from "#lib/router.svelte.ts";
  import { account } from "#lib/account.svelte.ts";
  import { ganymede } from "#lib/ganymede/source.svelte.ts";
  import { gate } from "#lib/gate.svelte.ts";
  import { play } from "#lib/sounds.ts";
  import { reporter } from "#lib/report.svelte.ts";
  import { network } from "#lib/network.svelte.ts";
  import { updates } from "#lib/updates.svelte.ts";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import ReportDialog from "#lib/components/ReportDialog.svelte";
  import Logo from "#lib/components/Logo.svelte";
  import StatusBanners from "#lib/components/StatusBanners.svelte";

  let { children } = $props();

  router.install();
  reporter.install();

  /** "Exit SERAPH?" dialog, shown when Back is pressed on a top-level screen. */
  let confirmExit = $state(false);
  let exitReturnFocus: HTMLElement | null = null;

  async function askExit() {
    exitReturnFocus = document.activeElement as HTMLElement | null;
    confirmExit = true;
    await tick();
    focusById("exit-stay");
  }

  function keepWatching() {
    confirmExit = false;
    if (exitReturnFocus?.isConnected) exitReturnFocus.focus({ preventScroll: true });
    else focusFirst();
  }

  // Setup gating: when a setup screen is required, go there; when the splash (or a setup step that
  // only exists because of the gate) is no longer needed, continue to where the user was going.
  const AUTO_LEAVE = new Set(["starting", "welcome", "plex-servers"]);
  $effect(() => {
    const req = gate.required;
    const here = router.current;
    untrack(() => {
      if (req) {
        if (gate.allowed(here.route.name, req)) return;
        if (!gate.isSetup(here.route.name) && here.path !== "/" && gate.pending === null) gate.pending = here.path;
        router.root(setupRoute(req));
      } else if (AUTO_LEAVE.has(here.route.name)) {
        gate.finish();
      }
    });
  });

  /** Back key: close what's on top, else go back, else home, else ask before exiting. */
  function handleBack() {
    if (reporter.current) return reporter.dismiss();
    if (confirmExit) return keepWatching();
    const name = router.current.route.name;
    if (name === "plex-servers" && account.connected.length) return account.doneChoosing(); // leaves via the gate effect
    if (router.back()) return;
    if (!gate.isSetup(name) && name !== "home") return router.root({ name: "home" });
    void askExit();
  }

  onMount(() => {
    installInput();
    registerPlatformKeys();
    network.install();
    // Menu sounds stay quiet while a video is playing.
    const sfx = (s: Parameters<typeof play>[0]) => {
      if (router.current.route.name !== "player" || reporter.current || confirmExit) play(s);
    };
    setFallback((e) => {
      switch (e.action) {
        case "up":
        case "down":
        case "left":
        case "right":
          sfx(move(e.action) ? "move" : "bump");
          return true;
        case "ok": {
          const done = activate();
          if (done) sfx("select");
          return done;
        }
        case "back":
          handleBack();
          sfx("back");
          return true;
      }
      return false;
    });
    account.start();
    ganymede.start();
    setTimeout(() => updates.check(), 15_000);
  });
</script>

<svelte:head><title>SERAPH</title></svelte:head>

{@render children()}

<StatusBanners />

{#if reporter.current}
  <ReportDialog />
{/if}

{#if confirmExit}
  <div class="scrim absolute inset-0 z-100 grid place-items-center" data-focus-trap role="alertdialog" aria-label="Exit SERAPH?">
    <div class="surface-container-low elevation-3 flex w-[44rem] flex-col items-center gap-6 rounded-[1.6rem] p-10 text-center">
      <Logo class="h-16" />
      <h2 class="text-[2rem] font-bold">Exit SERAPH?</h2>
      <p class="text-on-surface-variant">You can come back to where you left off any time.</p>
      <div class="flex gap-4" data-focus-group>
        <Btn variant="filled" data-focus-id="exit-stay" data-autofocus="" onclick={keepWatching}><Icon name="play" /> Keep watching</Btn>
        <Btn data-focus-id="exit-leave" onclick={() => exitApp()}><Icon name="logout" /> Exit</Btn>
      </div>
    </div>
  </div>
{/if}
