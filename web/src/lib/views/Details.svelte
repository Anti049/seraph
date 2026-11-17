<script lang="ts">
  import { untrack } from "svelte";
  import { plex } from "../account.svelte";
  import { episodeLabel, isWatched, type Hub, type Metadata } from "../plex";
  import { router } from "../router.svelte";
  import { clock, duration } from "../format";
  import { plexMoreMenu } from "../itemMenus";
  import Icon from "../components/Icon.svelte";
  import Btn from "../components/Btn.svelte";
  import Spinner from "../components/Spinner.svelte";
  import Row from "../components/Row.svelte";
  import MediaCard from "../components/MediaCard.svelte";
  import PersonCard from "../components/PersonCard.svelte";
  import Backdrop from "../components/Backdrop.svelte";
  import MenuDrawer from "../components/MenuDrawer.svelte";
  import { invalidatePlex } from "../plex";

  let { server, ratingKey }: { server: string; ratingKey: string } = $props();
  // keyed by server/id in the route, so these never change for this instance
  const s = plex(untrack(() => server));
  let item = $state<Metadata | null>(null);
  let related = $state<Hub[]>([]);
  let error = $state<string | null>(null);
  let more = $state(false);

  async function load() {
    try {
      item = await s.metadata(ratingKey);
      if (item?.type === "movie" && !related.length) related = (await s.related(ratingKey)).filter((h) => h.Metadata?.length).slice(0, 2);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  load();

  async function reload() {
    invalidatePlex();
    await load();
  }

  let watched = $derived(!!item && isWatched(item));
  let resumeAt = $derived(item?.viewOffset && item.viewOffset > 30000 ? item.viewOffset / 1000 : 0);
  let media = $derived(item?.Media?.[0]);
  let techLine = $derived.by(() => {
    const m = media;
    if (!m) return "";
    const res = m.videoResolution ? (/^\d+$/.test(m.videoResolution) ? `${m.videoResolution}p` : m.videoResolution.toUpperCase()) : "";
    return [res, m.videoCodec?.toUpperCase(), m.audioCodec?.toUpperCase(), m.audioChannels ? `${m.audioChannels}ch` : ""].filter(Boolean).join(" · ");
  });
  let genres = $derived(item?.Genre?.map((g) => g.tag).join(", ") ?? "");

  // Cast & crew: directors and writers first, then the cast (with their character names).
  type Person = { key: string; id?: number; name: string; role: string; photo?: string; by: "actor" | "director" | "writer" };
  let people = $derived.by((): Person[] => {
    if (!item) return [];
    const crew = (list: { tag: string; id?: number; thumb?: string }[] | undefined, role: string, by: Person["by"]) =>
      (list ?? []).map((p) => ({ key: `${by}-${p.id ?? p.tag}`, id: p.id, name: p.tag, role, photo: p.thumb, by }));
    return [
      ...crew(item.Director, "Director", "director"),
      ...crew(item.Writer, "Writer", "writer").slice(0, 2),
      ...(item.Role ?? []).slice(0, 20).map((p) => ({ key: `actor-${p.id ?? p.tag}`, id: p.id, name: p.tag, role: p.role ?? "", photo: p.thumb, by: "actor" as const })),
    ];
  });

  function openPerson(p: Person) {
    if (!item || !p.id) return;
    const section = String(item.librarySectionID ?? item.librarySectionKey?.split("/").pop() ?? "");
    if (!section) return;
    router.push({ name: "person", server, id: String(p.id), section, by: p.by, title: p.name });
  }

  const play = (offset = 0) => router.push({ name: "player", source: "plex", id: ratingKey, offset, server });

  async function toggleWatched() {
    if (!item) return;
    if (watched) await s.unscrobble(ratingKey);
    else await s.scrobble(ratingKey);
    await reload();
  }

  let menu = $derived(item ? plexMoreMenu(item, reload) : () => ({ title: "" }));
</script>

{#if error}
  <div class="page"><div class="empty-state">Couldn't load: {error}</div></div>
{:else if !item}
  <div class="page"><Spinner /></div>
{:else}
  <div class="absolute inset-0 overflow-hidden" data-scroll-y>
    <Backdrop src={s.image(item.art || item.grandparentArt || item.thumb, 1280, 720)} />
    <div class="relative pt-40 pr-16 pb-20 pl-12">
      {#if item.type === "episode"}
        <div class="mb-1.5 text-[1.25rem] font-bold text-primary">{item.grandparentTitle} · {episodeLabel(item)}</div>
      {/if}
      <h1 class="line-clamp-2 max-w-256 text-[3.4rem] leading-[1.1] font-extrabold tracking-tight">{item.title}</h1>
      <div class="mt-3.5 flex flex-wrap gap-x-6 gap-y-1 text-[1.15rem] text-subtext">
        {#if item.year}<span>{item.year}</span>{/if}
        {#if item.contentRating}<span class="rounded-[0.3rem] border-[0.1rem] border-dim px-2">{item.contentRating}</span>{/if}
        {#if item.duration}<span>{duration(item.duration / 1000)}</span>{/if}
        {#if item.audienceRating}<span>★ {item.audienceRating.toFixed(1)}</span>{/if}
        {#if genres}<span>{genres}</span>{/if}
        {#if techLine}<span>{techLine}</span>{/if}
        {#if watched}<span class="text-primary">Watched</span>{/if}
      </div>
      {#if item.tagline}<p class="mt-5 text-subtext italic">{item.tagline}</p>{/if}
      {#if item.summary}<p class="mt-3 line-clamp-3 max-w-232 text-[1.15rem] leading-normal text-on-surface-variant">{item.summary}</p>{/if}

      {#if resumeAt && item.duration}
        <div class="mt-6 flex items-center gap-4 text-on-surface-variant">
          <div class="h-[0.35rem] w-96 overflow-hidden rounded-full bg-white/20">
            <div class="h-full bg-primary" style:width="{Math.min(100, (resumeAt * 1000 * 100) / item.duration)}%"></div>
          </div>
          <span>{clock(item.duration / 1000 - resumeAt)} left</span>
        </div>
      {/if}

      <div class="mt-8 flex flex-wrap gap-4" data-focus-group>
        {#if resumeAt}
          <Btn variant="filled" data-autofocus="" data-focus-id="d-resume" onclick={() => play(resumeAt)}><Icon name="play" /> Resume</Btn>
          <Btn data-focus-id="d-restart" onclick={() => play(0)}><Icon name="restart" /> Restart</Btn>
        {:else}
          <Btn variant="filled" data-autofocus="" data-focus-id="d-play" onclick={() => play(0)}><Icon name="play" /> Play</Btn>
        {/if}
        <Btn data-focus-id="d-watched" onclick={toggleWatched}>
          <Icon name={watched ? "restart" : "check"} />
          {watched ? "Mark as unwatched" : "Mark as watched"}
        </Btn>
        <Btn data-focus-id="d-more" onclick={() => (more = true)}><Icon name="more" /> More</Btn>
      </div>

      {#if people.length}
        <section class="mt-11">
          <h2 class="mb-3.5 text-[1.55rem] font-bold">Cast &amp; crew</h2>
          <div class="-mx-4 -mt-4 flex gap-5 overflow-hidden p-4" data-scroll-x data-focus-group>
            {#each people as p (p.key)}
              <PersonCard name={p.name} role={p.role} photo={p.photo} focusId="cast-{p.key}" onclick={() => openPerson(p)} />
            {/each}
          </div>
        </section>
      {/if}

      {#each related as h (h.hubIdentifier)}
        <div class="mt-10">
          <Row title={h.title}>
            {#each h.Metadata ?? [] as m (m.ratingKey)}
              <MediaCard item={m} focusId="rel-{m.ratingKey}" />
            {/each}
          </Row>
        </div>
      {/each}
    </div>
  </div>
  <MenuDrawer root={menu} bind:open={more} />
{/if}
