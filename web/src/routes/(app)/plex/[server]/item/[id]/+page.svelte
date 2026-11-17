<script lang="ts">
  import { page } from "$app/state";
  import Details from "#lib/views/Details.svelte";
</script>

<!-- a new id on the same route (related item, next episode) is a fresh screen -->
{#key `${page.params.server}/${page.params.id}`}
  <Details server={page.params.server!} ratingKey={page.params.id!} />
{/key}
