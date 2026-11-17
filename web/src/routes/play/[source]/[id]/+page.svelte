<script lang="ts">
  import { page } from "$app/state";
  import { routeQuery } from "#lib/router.svelte.ts";
  import Player from "#lib/views/Player.svelte";

  // Hash routing keeps the query inside the hash, so it is read from there.
  const q = $derived.by(() => (page.params, routeQuery()));
</script>

<!-- a new id on the same route (related item, next episode) is a fresh screen -->
{#key `${page.params.source}/${page.params.id}`}
  <Player source={page.params.source as "plex" | "ganymede"} id={page.params.id!} offset={Number(q.get("t")) || 0} server={q.get("s") ?? undefined} />
{/key}
