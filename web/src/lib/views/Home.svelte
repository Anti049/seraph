<script lang="ts">
  import Btn from "../components/Btn.svelte";
  import { account } from "../account.svelte";
  import { ganymede } from "../ganymede/source.svelte";
  import { api as gapi, type Video } from "../ganymede/api";
  import type { Hub, Metadata } from "../plex";
  import { heroFromPlex, heroFromVideo, type HeroData } from "../hero";
  import Row from "../components/Row.svelte";
  import MediaCard from "../components/MediaCard.svelte";
  import VodCard from "../components/VodCard.svelte";
  import Spinner from "../components/Spinner.svelte";
  import Hero from "../components/Hero.svelte";

  const VIDEO_TYPES = ["movie", "show", "episode", "season", "clip"];

  let plexOn = $derived(account.ready);

  // Every connected Plex server: continue watching merged by most recent, hubs per server
  // (labelled with the server name when there's more than one).
  async function allContinue(): Promise<Metadata[]> {
    const lists = await Promise.all(account.connected.map((s) => s.continueWatching().catch(() => [] as Metadata[])));
    return lists.flat().sort((a, b) => (b.lastViewedAt ?? 0) - (a.lastViewedAt ?? 0));
  }
  async function allHubs(): Promise<Hub[]> {
    const multi = account.connected.length > 1;
    const lists = await Promise.all(
      account.connected.map((s) =>
        s
          .hubs()
          .then((hs) => hs.map((h) => ({ ...h, hubIdentifier: `${s.machineId}:${h.hubIdentifier}`, title: multi ? `${h.title} · ${s.name}` : h.title })))
          .catch(() => [] as Hub[]),
      ),
    );
    return lists.flat();
  }
  let gOn = $derived(ganymede.phase === "ready");

  let cont = $state<Metadata[]>([]);
  let hubs = $state<Hub[]>([]);
  let gCont = $state<Video[]>([]);
  let gRecent = $state<Video[]>([]);
  let loading = $state(true);
  let errors = $state<string[]>([]);
  let hero = $state<HeroData | null>(null);

  async function load() {
    loading = true;
    errors = [];
    const errs: string[] = [];
    const wrap = <T,>(label: string, p: Promise<T>, fallback: T) =>
      p.catch((e) => {
        errs.push(`${label}: ${(e as Error).message}`);
        return fallback;
      });
    const [c, h, gc, gr] = await Promise.all([
      plexOn ? wrap("Plex", allContinue(), [] as Metadata[]) : Promise.resolve([] as Metadata[]),
      plexOn ? wrap("Plex", allHubs(), [] as Hub[]) : Promise.resolve([] as Hub[]),
      gOn ? wrap("Ganymede", ganymede.continueWatching(), [] as Video[]) : Promise.resolve([] as Video[]),
      gOn
        ? wrap("Ganymede", gapi.videos({ limit: 20, offset: 0, sort_by: "date", order: "desc" }).then((p) => p.data ?? []), [] as Video[])
        : Promise.resolve([] as Video[]),
    ]);
    cont = c;
    hubs = h.filter((x) => x.Metadata?.length && VIDEO_TYPES.includes(x.type) && !/continue|ondeck/i.test(x.hubIdentifier));
    gCont = gc;
    gRecent = gr;
    errors = [...new Set(errs)];
    hero = cont[0]
      ? heroFromPlex(cont[0])
      : gCont[0]
        ? heroFromVideo(gCont[0])
        : hubs[0]?.Metadata?.[0]
          ? heroFromPlex(hubs[0].Metadata[0])
          : gRecent[0]
            ? heroFromVideo(gRecent[0])
            : null;
    loading = false;
  }
  load();

  const shapeFor = (h: Hub) => (h.type === "episode" || h.type === "clip" ? "wide" : "poster");
</script>

<div class="page pt-0" data-scroll-y>
  <Hero data={hero} />
  {#if loading}
    <Spinner />
  {:else}
    {#if cont.length}
      <Row title="Continue watching">
        {#each cont as m (m.ratingKey)}
          <MediaCard item={m} shape="wide" focusId="cw-{m.ratingKey}" onfocus={() => (hero = heroFromPlex(m))} />
        {/each}
      </Row>
    {/if}
    {#if gCont.length}
      <Row title="Continue watching streams">
        {#each gCont as v (v.id)}
          <VodCard video={v} focusId="gcw-{v.id}" onfocus={() => (hero = heroFromVideo(v))} />
        {/each}
      </Row>
    {/if}
    {#if gRecent.length}
      <Row title="Recent streams">
        {#each gRecent as v (v.id)}
          <VodCard video={v} focusId="grec-{v.id}" onfocus={() => (hero = heroFromVideo(v))} />
        {/each}
      </Row>
    {/if}
    {#each hubs as h (h.hubIdentifier)}
      <Row title={h.title}>
        {#each h.Metadata ?? [] as m (m.ratingKey)}
          <MediaCard item={m} shape={shapeFor(h)} focusId="{h.hubIdentifier}-{m.ratingKey}" onfocus={() => (hero = heroFromPlex(m))} />
        {/each}
      </Row>
    {/each}
    {#each errors as e (e)}
      <div class="empty-state">Couldn't load {e}</div>
    {/each}
    {#if !cont.length && !hubs.length && !gCont.length && !gRecent.length && !errors.length}
      <div class="empty-state">Nothing to show yet.</div>
    {/if}
    {#if errors.length}<Btn onclick={load}>Retry</Btn>{/if}
  {/if}
</div>
