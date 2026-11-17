<script lang="ts">
  import PageHeader from "../components/PageHeader.svelte";
  import { api } from "../ganymede/api";
  import VodGrid from "../components/VodGrid.svelte";

  let { id, title }: { id: string; title: string } = $props();
  const loader = (offset: number, limit: number) => api.videos({ offset, limit, playlist_id: id, sort_by: "date", order: "desc" });
</script>

<div class="page" data-scroll-y>
  <PageHeader {title} subtitle="Ganymede playlist" />
  <VodGrid load={loader} prefix="pv-{id}" emptyText="This playlist is empty." />
</div>
