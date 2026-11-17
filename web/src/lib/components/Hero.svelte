<script lang="ts">
  import type { HeroData } from "../hero";

  let { data }: { data: HeroData | null } = $props();

  // Debounce so D-pad scrolling through a row doesn't fire an image load per card.
  let shown = $state<HeroData | null>(null);
  let t: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const next = data;
    clearTimeout(t);
    t = setTimeout(() => (shown = next), shown ? 280 : 0);
    return () => clearTimeout(t);
  });
</script>

<header class="relative -mr-16 mb-2 -ml-12 flex h-[27rem] items-end overflow-hidden pr-16 pb-10 pl-12">
  {#key shown?.art}
    {#if shown?.art}
      <img class="absolute top-0 right-0 h-full w-[72%] animate-fade-in object-cover" src={shown.art} alt="" />
    {/if}
  {/key}
  <div
    class="absolute inset-0 bg-[linear-gradient(90deg,var(--theme-color-surface)_28%,rgb(30_30_46/0.55)_60%,rgb(30_30_46/0.1)),linear-gradient(0deg,var(--theme-color-surface)_0%,rgb(30_30_46/0)_55%)]"
  ></div>
  {#if shown}
    <div class="relative max-w-[58rem]">
      {#if shown.eyebrow}<div class="mb-1 text-[1.1rem] font-bold text-primary">{shown.eyebrow}</div>{/if}
      <h1 class="truncate text-5xl font-extrabold tracking-tight">{shown.title}</h1>
      <div class="mt-2 text-[1.15rem] whitespace-pre text-subtext">{shown.facts.join("   ·   ")}</div>
      {#if shown.summary}<p class="mt-3 line-clamp-2 text-[1.15rem] leading-[1.45] text-on-surface-variant">{shown.summary}</p>{/if}
    </div>
  {/if}
</header>
