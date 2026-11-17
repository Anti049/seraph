<script lang="ts">
  import { page } from "$app/state";
  import { routeQuery } from "#lib/router.svelte.ts";
  import GChannel from "#lib/views/GChannel.svelte";

  // Hash routing keeps the query inside the hash, so it is read from there.
  const q = $derived.by(() => (page.params, routeQuery()));
</script>

<!-- a new id on the same route (related item, next episode) is a fresh screen -->
{#key page.params.id}
  <GChannel id={page.params.id!} title={q.get("title") ?? ""} />
{/key}
