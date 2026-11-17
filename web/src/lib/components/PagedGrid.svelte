<script lang="ts" generics="T">
  // Infinite grid: loads a page, then the next one as focus nears the end.
  import { untrack, type Snippet } from "svelte";
  import Spinner from "./Spinner.svelte";

  let {
    load,
    key,
    card,
    columns = 7,
    lookahead = 14,
    emptyText = "Nothing here yet.",
    errorText = "Couldn't load",
  }: {
    load: (start: number) => Promise<{ items: T[]; total: number }>;
    key: (item: T) => string;
    card: Snippet<[T, () => void]>;
    columns?: number;
    lookahead?: number;
    emptyText?: string;
    errorText?: string;
  } = $props();

  let items = $state<T[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let started = $state(false);
  let error = $state<string | null>(null);

  async function more() {
    if (loading || (started && items.length >= total)) return;
    loading = true;
    try {
      const page = await load(items.length);
      started = true;
      total = page.total;
      items = items.concat(page.items);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load;
    untrack(() => {
      items = [];
      total = 0;
      started = false;
      error = null;
      more();
    });
  });
</script>

<div class="grid gap-x-6 gap-y-8" style:grid-template-columns="repeat({columns}, minmax(0, 1fr))">
  {#each items as item, i (key(item))}
    {@render card(item, () => i >= items.length - lookahead && more())}
  {/each}
</div>
{#if loading}
  <Spinner />
{:else if error}
  <div class="empty-state">{errorText}: {error}</div>
{:else if started && !items.length}
  <div class="empty-state">{emptyText}</div>
{/if}
