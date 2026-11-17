<script lang="ts" module>
  // Sort choice per library survives leaving and coming back.
  const sortBy = new Map<string, string>();
</script>

<script lang="ts">
  import PageHeader from "../components/PageHeader.svelte";
  import { untrack } from "svelte";
  import { account, plex } from "../account.svelte";
  import MediaGrid from "../components/MediaGrid.svelte";

  let { server, key, title }: { server: string; key: string; title: string } = $props();

  const sorts = [
    { id: "addedAt:desc", label: "Recently added" },
    { id: "titleSort", label: "Title" },
    { id: "originallyAvailableAt:desc", label: "Release date" },
    { id: "rating:desc", label: "Rating" },
    { id: "lastViewedAt:desc", label: "Last watched" },
  ];
  let sort = $state(untrack(() => sortBy.get(`${server}:${key}`)) ?? "addedAt:desc");
  $effect(() => void sortBy.set(`${server}:${key}`, sort));

  let loader = $derived.by(() => {
    const s = sort;
    return (start: number, size: number) => plex(server).sectionItems(key, start, size, s);
  });
</script>

<div class="page" data-scroll-y>
  <PageHeader {title} subtitle={account.connected.length > 1 ? `Plex · ${plex(server).name}` : "Plex"}>
    {#snippet trailing()}
      {#each sorts as s (s.id)}
        <button class={["chip", sort === s.id && "chip-on"]} data-focus-id="sort-{s.id}" onclick={() => (sort = s.id)}>{s.label}</button>
      {/each}
    {/snippet}
  </PageHeader>
  <MediaGrid load={loader} prefix="lib-{server}-{key}" />
</div>
