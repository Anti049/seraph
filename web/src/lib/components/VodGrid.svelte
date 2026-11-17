<script lang="ts">
  import type { Page, Video } from "../ganymede/api";
  import VodCard from "./VodCard.svelte";
  import PagedGrid from "./PagedGrid.svelte";

  let {
    load,
    prefix,
    showChannel = true,
    emptyText = "Nothing here yet.",
    columns = 4,
  }: { load: (offset: number, limit: number) => Promise<Page<Video>>; prefix: string; showChannel?: boolean; emptyText?: string; columns?: number } = $props();

  const PAGE = 24;
  let pager = $derived(async (start: number) => {
    const page = await load(start, PAGE);
    return { items: page.data ?? [], total: page.total_count };
  });
</script>

<PagedGrid load={pager} key={(v) => v.id} {columns} lookahead={8} {emptyText} errorText="Couldn't load videos">
  {#snippet card(v: Video, near: () => void)}
    <VodCard video={v} focusId="{prefix}-{v.id}" {showChannel} width="100%" onfocus={near} />
  {/snippet}
</PagedGrid>
