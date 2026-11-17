<script lang="ts">
  // The player is full-screen on its own, outside the main UI's side rail.
  import { reporter } from "#lib/report.svelte.ts";
  import { router } from "#lib/router.svelte.ts";
  import { screenFocus } from "#lib/screenFocus.svelte.ts";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";

  let { children } = $props();
  let root = $state<HTMLElement>();
  screenFocus(() => root);
</script>

<div class="absolute inset-0" bind:this={root}>
  <svelte:boundary onerror={(e: unknown) => reporter.capture(e, "screen")}>
    {@render children()}
    {#snippet failed()}
      <div class="page flex flex-col items-start justify-center gap-6">
        <Icon name="info" size="3rem" />
        <h1 class="text-[2.6rem] font-bold">This video couldn't be played</h1>
        <div class="flex gap-4" data-focus-group>
          <Btn variant="filled" data-autofocus="" onclick={() => router.back() || router.root({ name: "home" })}><Icon name="back" /> Go back</Btn>
        </div>
      </div>
    {/snippet}
  </svelte:boundary>
</div>
