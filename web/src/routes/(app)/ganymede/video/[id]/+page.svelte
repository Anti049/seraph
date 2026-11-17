<script lang="ts">
  import { page } from "$app/state";
  import GVideo from "#lib/views/GVideo.svelte";
</script>

<!-- a new id on the same route (related item, next episode) is a fresh screen -->
{#key page.params.id}
  <GVideo id={page.params.id!} />
{/key}
