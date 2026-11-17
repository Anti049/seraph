<script lang="ts">
  import type { Metadata } from "../plex";
  import MediaCard from "./MediaCard.svelte";
  import PagedGrid from "./PagedGrid.svelte";

  let {
    load,
    prefix,
    shape = "poster",
    emptyText = "Nothing here yet.",
  }: {
    load: (start: number, size: number) => Promise<{ items: Metadata[]; total: number }>;
    prefix: string;
    shape?: "poster" | "wide";
    emptyText?: string;
  } = $props();

  const PAGE = 42;
  let pager = $derived((start: number) => load(start, PAGE));
</script>

<PagedGrid load={pager} key={(m) => m.ratingKey} columns={shape === "wide" ? 4 : 7} {emptyText}>
  {#snippet card(item: Metadata, near: () => void)}
    <MediaCard {item} {shape} width="100%" focusId="{prefix}-{item.ratingKey}" onfocus={near} />
  {/snippet}
</PagedGrid>
