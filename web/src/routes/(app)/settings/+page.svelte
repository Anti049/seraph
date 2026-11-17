<script lang="ts">
  // /settings on its own opens the first section.
  import { onMount } from "svelte";
  import { router } from "#lib/router.svelte.ts";

  onMount(() => router.replace({ name: "settings", section: "profiles" }));
</script>
