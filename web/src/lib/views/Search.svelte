<script lang="ts" module>
  import type { Hub } from "../plex";
  import type { Video } from "../ganymede/api";

  // Kept outside the component so the query and results are still there after opening a result
  // and pressing Back.
  const last = { text: "", hubs: [] as Hub[], vods: [] as Video[], searched: false };
</script>

<script lang="ts">
  import { account } from "../account.svelte";
  import { ganymede } from "../ganymede/source.svelte";
  import { api as gapi } from "../ganymede/api";
  import Row from "../components/Row.svelte";
  import MediaCard from "../components/MediaCard.svelte";
  import VodCard from "../components/VodCard.svelte";
  import Spinner from "../components/Spinner.svelte";
  import Icon from "../components/Icon.svelte";

  let text = $state(last.text);
  let hubs = $state<Hub[]>(last.hubs);
  let vods = $state<Video[]>(last.vods);
  let searched = $state(last.searched);
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;

  $effect(() => {
    Object.assign(last, { text, hubs, vods, searched });
  });

  /** Search every connected server; rows of the same kind are merged. */
  async function searchPlex(q: string): Promise<Hub[]> {
    const lists = await Promise.all(account.connected.map((s) => s.search(q).catch(() => [] as Hub[])));
    const byType = new Map<string, Hub>();
    for (const h of lists.flat()) {
      const row = byType.get(h.type);
      if (row) row.Metadata = [...(row.Metadata ?? []), ...(h.Metadata ?? [])];
      else byType.set(h.type, { ...h, hubIdentifier: `search-${h.type}`, Metadata: [...(h.Metadata ?? [])] });
    }
    return [...byType.values()];
  }

  async function run(q: string) {
    const my = ++seq;
    if (q.length < 2) {
      searched = false;
      hubs = [];
      vods = [];
      return;
    }
    busy = true;
    const [h, v] = await Promise.all([
      account.ready ? searchPlex(q) : Promise.resolve([] as Hub[]),
      ganymede.phase === "ready"
        ? gapi
            .search(q, 24, 0)
            .then((p) => p.data ?? [])
            .catch(() => [] as Video[])
        : Promise.resolve([] as Video[]),
    ]);
    if (my !== seq) return;
    hubs = h;
    vods = v;
    searched = true;
    busy = false;
  }

  function oninput() {
    clearTimeout(timer);
    timer = setTimeout(() => run(text.trim()), 500);
  }

  function submit(e: Event) {
    e.preventDefault();
    clearTimeout(timer);
    run(text.trim());
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
</script>

<div class="page" data-scroll-y>
  <form
    class="mb-10 flex h-20 items-center gap-5 rounded-[1.2rem] border-[0.15rem] border-transparent bg-surface-container px-7 text-on-surface-variant focus-within:border-on-surface focus-within:text-on-surface"
    onsubmit={submit}
  >
    <Icon name="search" size="2rem" />
    <input
      class="h-full flex-1 border-0 bg-transparent text-[1.6rem] placeholder:text-dim"
      bind:value={text}
      {oninput}
      placeholder="Movies, shows, streams, channels…"
      enterkeyhint="search"
      autocapitalize="off"
      spellcheck="false"
      data-focus-id="search-input"
      data-autofocus={searched ? undefined : ""}
    />
  </form>
  {#if busy}
    <Spinner />
  {:else if !searched}
    <div class="empty-state">Press OK to type. Results appear as you search.</div>
  {:else if !hubs.length && !vods.length}
    <div class="empty-state">No results for “{text}”.</div>
  {:else}
    {#each hubs as h (h.hubIdentifier)}
      <Row title={h.title}>
        {#each h.Metadata ?? [] as m (m.ratingKey)}
          <MediaCard item={m} shape={h.type === "episode" ? "wide" : "poster"} focusId="s-{h.hubIdentifier}-{m.ratingKey}" />
        {/each}
      </Row>
    {/each}
    {#if vods.length}
      <Row title="Streams">
        {#each vods as v (v.id)}
          <VodCard video={v} focusId="s-g-{v.id}" />
        {/each}
      </Row>
    {/if}
  {/if}
</div>
