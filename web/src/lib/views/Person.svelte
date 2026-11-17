<script lang="ts">
  // Everything in a library with a given actor, director or writer.
  import { plex } from "../account.svelte";
  import MediaGrid from "../components/MediaGrid.svelte";
  import PageHeader from "../components/PageHeader.svelte";

  let { server, id, section, by, title }: { server: string; id: string; section: string; by: "actor" | "director" | "writer"; title: string } = $props();
  const role = $derived({ actor: "Appears in", director: "Directed", writer: "Written" }[by]);
  const loader = (start: number, size: number) => plex(server).byPerson(section, by, id, start, size);
</script>

<div class="page" data-scroll-y>
  <PageHeader {title} subtitle="{role} · {plex(server).name}" />
  <MediaGrid load={loader} prefix="person-{id}" emptyText="Nothing else in this library." />
</div>
