<script lang="ts">
  import { untrack } from "svelte";
  import { plex } from "../account.svelte";
  import { isWatched, progressOf, type Metadata } from "../plex";
  import { router } from "../router.svelte";
  import { duration } from "../format";
  import Icon from "../components/Icon.svelte";
  import Btn from "../components/Btn.svelte";
  import Spinner from "../components/Spinner.svelte";
  import Backdrop from "../components/Backdrop.svelte";
  import MenuDrawer from "../components/MenuDrawer.svelte";
  import PersonCard from "../components/PersonCard.svelte";
  import { plexMoreMenu } from "../itemMenus";
  import { invalidatePlex } from "../plex";

  let { server, ratingKey, season: initialSeason }: { server: string; ratingKey: string; season?: string } = $props();
  const sv = plex(untrack(() => server));
  let more = $state(false);

  let show = $state<Metadata | null>(null);
  let seasons = $state<Metadata[]>([]);
  let season = $state<string | null>(untrack(() => initialSeason ?? null));
  let episodes = $state<Metadata[] | null>(null);
  let error = $state<string | null>(null);

  async function load() {
    try {
      const s = sv;
      const [m, kids] = await Promise.all([s.metadata(ratingKey), s.children(ratingKey)]);
      show = m;
      seasons = kids.filter((k) => k.type === "season");
      if (!season) {
        const deck = m?.OnDeck?.Metadata?.[0];
        season = (deck && seasons.find((x) => x.index === deck.parentIndex)?.ratingKey) ?? seasons[0]?.ratingKey ?? null;
      }
    } catch (e) {
      error = (e as Error).message;
    }
  }
  load();

  // Keep the chosen season in the URL, so Back from an episode lands on the same season.
  $effect(() => {
    const s = season;
    if (s && s !== initialSeason) untrack(() => router.replace({ name: "show", server, ratingKey, season: s }));
  });

  $effect(() => {
    const id = season;
    if (!id) return;
    episodes = null;
    sv
      .children(id)
      .then((e) => {
        if (season === id) episodes = e;
      })
      .catch(() => (episodes = []));
  });

  let next = $derived(show?.OnDeck?.Metadata?.[0] ?? null);
  let allWatched = $derived(!!show && isWatched(show));

  async function toggleWatched() {
    if (!show) return;
    if (allWatched) await sv.unscrobble(show.ratingKey);
    else await sv.scrobble(show.ratingKey);
    await load();
    if (season) episodes = await sv.children(season);
  }

  function play(ep: Metadata) {
    const off = ep.viewOffset && !isWatched(ep) ? ep.viewOffset / 1000 : 0;
    router.push({ name: "player", source: "plex", id: ep.ratingKey, offset: off, server });
  }
</script>

{#if error}
  <div class="page"><div class="empty-state">Couldn't load show: {error}</div></div>
{:else if !show}
  <div class="page"><Spinner /></div>
{:else}
  <div class="absolute inset-0 overflow-hidden" data-scroll-y>
    <Backdrop src={sv.image(show.art, 1280, 720)} height="70%" fade={70} />
    <div class="relative pt-36 pr-16 pb-24 pl-12">
      <h1 class="max-w-280 text-[3.4rem] font-extrabold tracking-tight">{show.title}</h1>
      <div class="mt-3 flex gap-6 text-[1.15rem] text-subtext">
        {#if show.year}<span>{show.year}</span>{/if}
        {#if show.contentRating}<span>{show.contentRating}</span>{/if}
        <span>{seasons.length} season{seasons.length === 1 ? "" : "s"}</span>
        {#if show.studio}<span>{show.studio}</span>{/if}
      </div>
      {#if show.summary}<p class="mt-4 line-clamp-2 max-w-240 text-[1.15rem] leading-normal text-on-surface-variant">{show.summary}</p>{/if}

      <div class="mt-8 flex gap-4" data-focus-group>
        {#if next}
          <Btn variant="filled" data-autofocus="" data-focus-id="s-next" onclick={() => play(next!)}>
            <Icon name="play" />
            {next.viewOffset ? "Resume" : "Play"} S{next.parentIndex} · E{next.index}
          </Btn>
        {/if}
        <Btn data-focus-id="s-watched" onclick={toggleWatched}>
          <Icon name={allWatched ? "restart" : "check"} />
          {allWatched ? "Mark as unwatched" : "Mark as watched"}
        </Btn>
        <Btn data-focus-id="s-more" onclick={() => (more = true)}><Icon name="more" /> More</Btn>
      </div>

      {#if seasons.length > 1}
        <div class="-mx-4 mt-10 flex gap-3 overflow-hidden px-4 py-2.5" data-focus-group data-scroll-x>
          {#each seasons as s (s.ratingKey)}
            <button
              class={["chip flex-none", season === s.ratingKey && "chip-on"]}
              data-focus-id="season-{s.ratingKey}"
              data-focus-default={season === s.ratingKey ? "" : undefined}
              onclick={() => (season = s.ratingKey)}
            >
              {s.title}
            </button>
          {/each}
        </div>
      {/if}

      <div class="mt-6 flex max-w-352 flex-col gap-2.5" data-focus-group>
        {#if !episodes}
          <Spinner />
        {:else}
          {#each episodes as ep (ep.ratingKey)}
            {@const frac = progressOf(ep)}
            <button
              class="group flex gap-7 rounded-2xl p-3.5 text-left transition-colors duration-150 focus:bg-surface-container-high"
              data-focus-id="ep-{ep.ratingKey}"
              onclick={() => play(ep)}
            >
              <div class="relative h-[10.7rem] w-76 flex-none overflow-hidden rounded-[0.6rem] bg-surface-container group-focus:shadow-ring">
                <img class="size-full object-cover" src={sv.image(ep.thumb, 400, 225)} alt="" loading="lazy" />
                {#if frac > 0}
                  <div class="absolute inset-x-0 bottom-0 h-[0.3rem] bg-white/25"><div class="h-full bg-primary" style:width="{frac * 100}%"></div></div>
                {/if}
                {#if isWatched(ep)}
                  <span class="badge badge-filled badge-surface tv-badge absolute! top-2 right-2 px-0 text-primary" aria-label="Watched"><Icon name="check" size="1.1rem" /></span>
                {/if}
              </div>
              <div class="min-w-0 pt-1.5">
                <div class="truncate text-[1.35rem] font-semibold"><span class="mr-3 text-on-surface-variant">{ep.index}</span>{ep.title}</div>
                <div class="mt-1 mb-2.5 text-on-surface-variant">
                  {#if ep.duration}{duration(ep.duration / 1000)}{/if}
                  {#if ep.originallyAvailableAt} · {ep.originallyAvailableAt}{/if}
                </div>
                {#if ep.summary}<p class="line-clamp-2 leading-[1.45] text-on-surface-variant">{ep.summary}</p>{/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>
      {#if show.Role?.length}
        <section class="mt-11">
          <h2 class="mb-3.5 text-[1.55rem] font-bold">Cast &amp; crew</h2>
          <div class="-mx-4 -mt-4 flex gap-5 overflow-hidden p-4" data-scroll-x data-focus-group>
            {#each show.Role.slice(0, 20) as p (p.id ?? p.tag)}
              <PersonCard
                name={p.tag}
                role={p.role ?? ""}
                photo={p.thumb}
                focusId="cast-{p.id ?? p.tag}"
                onclick={() =>
                  p.id &&
                  show?.librarySectionID &&
                  router.push({ name: "person", server, id: String(p.id), section: String(show.librarySectionID), by: "actor", title: p.tag })}
              />
            {/each}
          </div>
        </section>
      {/if}
    </div>
  </div>
{/if}
{#if show}
  <MenuDrawer root={plexMoreMenu(show, async () => (invalidatePlex(), await load()))} bind:open={more} />
{/if}
