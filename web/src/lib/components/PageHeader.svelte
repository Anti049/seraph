<script lang="ts">
  // Page title bar: lunar-ui appbar (title + subtitle, trailing actions) at TV scale.
  import type { Snippet } from "svelte";
  let { title, subtitle, trailing }: { title: string; subtitle?: string; trailing?: Snippet } = $props();
</script>

<header class="appbar tv-appbar">
  <div class="appbar-body">
    <h1 class="appbar-title">{title}</h1>
    {#if subtitle}<p class="appbar-subtitle">{subtitle}</p>{/if}
  </div>
  {#if trailing}
    <div class="appbar-trailing" data-focus-group>{@render trailing()}</div>
  {/if}
</header>
