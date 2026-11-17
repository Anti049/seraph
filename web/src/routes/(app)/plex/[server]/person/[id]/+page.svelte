<script lang="ts">
  import { page } from "$app/state";
  import { routeQuery } from "#lib/router.svelte.ts";
  import Person from "#lib/views/Person.svelte";

  // Hash routing keeps the query inside the hash, so it is read from there.
  const q = $derived.by(() => (page.params, routeQuery()));
</script>

{#key `${page.params.server}/${page.params.id}`}
  <Person
    server={page.params.server!}
    id={page.params.id!}
    section={q.get("section") ?? ""}
    by={(q.get("by") ?? "actor") as "actor" | "director" | "writer"}
    title={q.get("title") ?? ""}
  />
{/key}
