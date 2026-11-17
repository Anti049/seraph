<script lang="ts">
  // Ganymede channel pages share a second sidebar listing every channel.
  import { page } from "$app/state";
  import ChannelRail from "#lib/components/ChannelRail.svelte";

  let { children } = $props();
</script>

<div class="page flex gap-10 pl-6">
  <ChannelRail active={page.params.id ?? null} />
  {@render children()}
</div>
