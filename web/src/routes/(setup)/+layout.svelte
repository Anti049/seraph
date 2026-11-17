<script lang="ts">
  // Full-screen setup screens: splash, profiles, adding Plex or Ganymede. No side rail.
  import { screenFocus } from "#lib/screenFocus.svelte.ts";

  let { children } = $props();
  let root = $state<HTMLElement>();
  screenFocus(() => root);
</script>

<div class="absolute inset-0 bg-glow" bind:this={root} data-focus-trap>
  {@render children()}
</div>
