<script lang="ts" generics="T">
  // One settings row: a label and a chip per option.
  import type { Opt } from "./options";
  let { label, opts, value, pick, wrap = false }: { label: string; opts: Opt<T>[]; value: T; pick: (v: T) => void; wrap?: boolean } = $props();
</script>

<div class={["mb-4 flex items-center gap-3", wrap && "flex-wrap gap-y-3"]} data-focus-group>
  <span class={["flex-none text-on-surface-variant", wrap ? "w-full" : "w-88"]}>{label}</span>
  {#each opts as o (o.l)}
    <button class={["chip gap-2", value === o.v && "chip-on"]} style={o.style} onclick={() => pick(o.v)}>
      {#if o.swatch}<span class="size-[1.1rem] rounded-full shadow-[0_0_0_0.1rem_rgb(0_0_0/0.5)]" style:background={o.swatch}></span>{/if}
      {o.l}
    </button>
  {/each}
</div>
