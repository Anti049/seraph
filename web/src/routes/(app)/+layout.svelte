<script lang="ts">
  // Main UI: lunar-ui scaffold with the side rail in the first column and the current screen in
  // scaffold-body. Nested layouts (Settings, Ganymede channels) keep their own second sidebar.
  import { page } from "$app/state";
  import { router } from "#lib/router.svelte.ts";
  import { account } from "#lib/account.svelte.ts";
  import { ganymede } from "#lib/ganymede/source.svelte.ts";
  import { gate } from "#lib/gate.svelte.ts";
  import { reporter } from "#lib/report.svelte.ts";
  import { invalidatePlex } from "#lib/plex.ts";
  import { invalidateGanymede } from "#lib/ganymede/api.ts";
  import { screenFocus } from "#lib/screenFocus.svelte.ts";
  import Sidebar from "#lib/components/Sidebar.svelte";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";

  let { children } = $props();
  let view = $state<HTMLElement>();
  screenFocus(() => view);

  // Rebuild the main UI when the set of sources changes (a server or Ganymede added/removed).
  let sig = $derived(
    `${gate.plexReady ? account.connected.map((c) => c.machineId).join(",") : "-"}|${gate.ganymedeReady ? ganymede.url : "-"}`,
  );
  let lastSig: string | undefined;
  $effect(() => {
    const s = sig;
    if (lastSig !== undefined && s !== lastSig) {
      invalidatePlex();
      invalidateGanymede();
      router.root({ name: "home" });
    }
    lastSig = s;
  });

  // A screen is rebuilt when its route or parameters change, but a nested layout's sidebar stays
  // put while you move between its pages.
  const NESTED = [/^\/\(app\)\/settings\//, /^\/\(app\)\/ganymede\/\(channels\)\//];
  let screenKey = $derived.by(() => {
    const id = page.route.id ?? "";
    const nested = NESTED.find((re) => re.test(id));
    return nested ? nested.source : `${id}${JSON.stringify(page.params)}`;
  });
</script>

{#key sig}
  <div class="scaffold tv-scaffold absolute inset-0">
    <Sidebar />
    <main class="scaffold-body overflow-visible" bind:this={view}>
      <!-- One broken screen shouldn't take the app down: show what happened and offer a way out. -->
      {#key screenKey}
        <svelte:boundary onerror={(e: unknown) => reporter.capture(e, "screen")}>
          {@render children()}
          {#snippet failed(_error, reset)}
            <div class="page absolute inset-0 flex flex-col items-start justify-center gap-6">
              <Icon name="info" size="3rem" />
              <h1 class="text-[2.6rem] font-bold">This screen couldn't be shown</h1>
              <p class="max-w-232 text-[1.2rem] text-on-surface-variant">
                The problem has been recorded. You can go back, try again, or scan the code in the report to send it to GitHub.
              </p>
              <div class="flex gap-4" data-focus-group>
                <Btn variant="filled" data-autofocus="" onclick={() => router.back() || router.root({ name: "home" })}><Icon name="back" /> Go back</Btn>
                <Btn onclick={reset}><Icon name="restart" /> Try again</Btn>
              </div>
            </div>
          {/snippet}
        </svelte:boundary>
      {/key}
    </main>
  </div>
{/key}
