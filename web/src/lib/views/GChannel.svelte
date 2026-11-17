<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { api, type Video } from "../ganymede/api";
  import { ChannelGames } from "../ganymede/games.svelte";
  import PageHeader from "../components/PageHeader.svelte";
  import VodGrid from "../components/VodGrid.svelte";
  import VodCard from "../components/VodCard.svelte";
  import Icon from "../components/Icon.svelte";

  let { id, title }: { id: string; title: string } = $props();

  const filters = [
    { key: "", label: "All" },
    { key: "archive", label: "Streams" },
    { key: "highlight", label: "Highlights" },
    { key: "clip", label: "Clips" },
    { key: "upload", label: "Uploads" },
  ];
  let type = $state("");
  let sort = $state<"date" | "views">("date");
  let game = $state<string | null>(null);

  // Games come from the videos' chapters (see ganymede/games.svelte.ts).
  const games = new ChannelGames(untrack(() => id));
  onDestroy(() => games.cancel());

  let loader = $derived.by(() => {
    const t = type;
    const s = sort;
    return (offset: number, limit: number) => api.videos({ offset, limit, channel_id: id, types: t || undefined, sort_by: s, order: "desc" });
  });

  // With a game picked, the list is filtered on the TV.
  let filtered = $derived.by((): Video[] => {
    if (!game) return [];
    return games
      .withGame(game)
      .filter((v) => !type || v.type === type)
      .sort((a, b) => (sort === "views" ? (b.views ?? 0) - (a.views ?? 0) : +new Date(b.streamed_at) - +new Date(a.streamed_at)));
  });
</script>

<div class="min-w-0 flex-1 overflow-hidden" data-scroll-y>
    <PageHeader {title} subtitle={game ? `Ganymede · ${game}` : "Ganymede channel"}>
      {#snippet trailing()}
        {#each filters as f (f.key)}
          <button class={["chip", type === f.key && "chip-on"]} data-focus-id="filter-{f.key || 'all'}" onclick={() => (type = f.key)}>
            {f.label}
          </button>
        {/each}
        <button class="chip ml-4" data-focus-id="sort" onclick={() => (sort = sort === "date" ? "views" : "date")}>
          Sort: {sort === "date" ? "Newest" : "Most viewed"}
        </button>
      {/snippet}
    </PageHeader>

    <!-- game filter -->
    <div class="-mx-4 -mt-3 mb-6 flex items-center gap-3 overflow-hidden px-4 py-2" data-scroll-x data-focus-group>
      <span class="flex flex-none items-center gap-2 text-dim"><Icon name="games" size="1.6rem" /> Games</span>
      <button class={["chip", game === null && "chip-on"]} data-focus-id="game-all" onclick={() => (game = null)}>All games</button>
      {#each games.games as g (g.name)}
        <button class={["chip gap-2", game === g.name && "chip-on"]} data-focus-id="game-{g.name}" onclick={() => (game = g.name)}>
          {g.name}<span class="text-[0.9rem] text-dim">{g.count}</span>
        </button>
      {/each}
      {#if games.loading}
        <span class="flex-none text-[0.95rem] text-dim">
          {games.total ? `Finding games… ${games.done}/${games.total}` : "Finding games…"}
        </span>
      {:else if !games.games.length}
        <span class="flex-none text-[0.95rem] text-dim">No game info in this channel's chapters.</span>
      {/if}
    </div>

    {#if game}
      {#if filtered.length}
        <div class="grid grid-cols-3 gap-x-6 gap-y-8 pb-24">
          {#each filtered as v (v.id)}
            <VodCard video={v} focusId="gv-{v.id}" showChannel={false} width="100%" />
          {/each}
        </div>
      {:else}
        <div class="empty-state">No {type ? filters.find((f) => f.key === type)?.label.toLowerCase() : "videos"} with {game}.</div>
      {/if}
    {:else}
      <VodGrid load={loader} prefix="cv-{id}" showChannel={false} columns={3} />
    {/if}
  </div>
