<script lang="ts">
  // Small, non-blocking notices along the top edge: offline, back online, update available.
  import { network } from "../network.svelte";
  import { updates } from "../updates.svelte";
  import Icon from "./Icon.svelte";

  let showUpdate = $state(false);
  // Mention an update once per launch, for a few seconds.
  $effect(() => {
    if (!updates.available || updates.dismissed) return;
    showUpdate = true;
    const t = setTimeout(() => ((showUpdate = false), (updates.dismissed = true)), 9000);
    return () => clearTimeout(t);
  });
  const pill = "elevation-2 flex items-center gap-3 rounded-full px-6 py-2.5 text-[1.05rem] font-semibold animate-fade-in";
</script>

<div class="pointer-events-none absolute top-6 left-1/2 z-80 flex -translate-x-1/2 flex-col items-center gap-3" aria-live="polite">
  {#if !network.online}
    <div class="{pill} error-container"><Icon name="info" size="1.5rem" /> No network connection. Reconnecting when it's back…</div>
  {:else if network.restored}
    <div class="{pill} surface-container-high"><Icon name="check" size="1.5rem" /> Back online</div>
  {/if}
  {#if showUpdate && updates.available}
    <div class="{pill} primary-container">
      <Icon name="info" size="1.5rem" />
      {updates.available.name} is available · Settings → Updates
    </div>
  {/if}
</div>
