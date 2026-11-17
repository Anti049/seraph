<script lang="ts">
  import type { Snippet } from "svelte";
  let { title, children, action }: { title: string; children: Snippet; action?: Snippet } = $props();
</script>

<section class="mb-9">
  <div class="mb-3.5 flex items-center gap-5">
    <h2 class="text-[1.55rem] font-bold">{title}</h2>
    {#if action}{@render action()}{/if}
  </div>
  <!-- the padding leaves room for the focused card's scale + ring -->
  <div class="-mx-4 -mt-4 flex gap-6 overflow-hidden p-4" data-scroll-x data-focus-group>
    {@render children()}
    <div class="w-12 flex-none"></div>
  </div>
</section>
