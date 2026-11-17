<script lang="ts">
  import { plexFor } from "../account.svelte";
  import { episodeLabel, isWatched, progressOf, type Metadata } from "../plex";
  import { open } from "../open";
  import Icon from "./Icon.svelte";
  import CardArt from "./CardArt.svelte";
  import CardMeta from "./CardMeta.svelte";

  let {
    item,
    focusId,
    shape = "poster",
    width,
    onfocus,
  }: {
    item: Metadata;
    focusId: string;
    shape?: "poster" | "wide";
    width?: string;
    onfocus?: () => void;
  } = $props();

  // Wide cards: episodes use their own still; movies/shows use backdrop art.
  let img = $derived.by(() => {
    const s = plexFor(item);
    if (shape === "wide") {
      const src = item.type === "episode" ? item.thumb : item.art || item.grandparentArt || item.thumb;
      return s.image(src, 480, 270);
    }
    const src = item.type === "episode" || item.type === "season" ? item.grandparentThumb || item.parentThumb || item.thumb : item.thumb;
    return s.image(src, 300, 450);
  });

  let title = $derived(item.type === "episode" && shape === "poster" ? (item.grandparentTitle ?? item.title) : item.title);
  let sub = $derived.by(() => {
    if (item.type === "episode") {
      return shape === "wide" ? `${item.grandparentTitle ?? ""} · ${episodeLabel(item)}` : episodeLabel(item);
    }
    if (item.type === "season") return item.parentTitle ?? "";
    if (item.type === "show") return item.childCount ? `${item.childCount} season${item.childCount === 1 ? "" : "s"}` : String(item.year ?? "");
    return item.year ? String(item.year) : "";
  });
  let watched = $derived(isWatched(item));
  let unwatched = $derived(
    (item.type === "show" || item.type === "season") && item.leafCount ? item.leafCount - (item.viewedLeafCount ?? 0) : 0,
  );
</script>

<button
  class={[
    "group relative flex-none origin-[center_35%] text-left transition duration-[180ms] ease-tv focus:z-2 focus:scale-108",
    shape === "wide" ? "w-[23rem]" : "w-[13.5rem]",
  ]}
  style:width
  data-focus-id={focusId}
  onclick={() => open(item)}
  {onfocus}
>
  <CardArt src={img} fallback={title} ratio={shape === "wide" ? "wide" : "poster"} progress={progressOf(item)}>
    {#if watched}
      <span class="badge badge-filled badge-surface tv-badge absolute! top-2 right-2 px-0 text-primary" aria-label="Watched">
        <Icon name="check" size="1.2rem" />
      </span>
    {:else if unwatched > 0}
      <span class="badge badge-filled badge-primary tv-badge absolute! top-2 right-2" aria-label="{unwatched} unwatched">{unwatched}</span>
    {/if}
  </CardArt>
  <CardMeta {title} {sub} />
</button>
