<script lang="ts">
  // Ganymede setup: look for servers on the TV's network.
  import Btn from "../components/Btn.svelte";
  import Icon from "../components/Icon.svelte";
  import Spinner from "../components/Spinner.svelte";
  import { onDestroy, onMount } from "svelte";
  import { canScanNatively, localIp, scan, subnetOf, type Found, type ScanHandle } from "../ganymede/discover";
  import { connectTo } from "../ganymede/setupFlow";
  import { router } from "../router.svelte";

  let subnet = $state("");
  let needSubnet = $state(false);
  let scanning = $state(false);
  let progress = $state({ done: 0, total: 0 });
  let found = $state<Found[]>([]);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let handle: ScanHandle | null = null;

  async function begin() {
    error = null;
    found = [];
    if (canScanNatively()) return start(null);
    const ip = await localIp();
    if (ip) {
      subnet = subnetOf(ip);
      start(subnet);
    } else {
      needSubnet = true;
      subnet = subnet || "192.168.1";
    }
  }

  function start(net: string | null, e?: Event) {
    e?.preventDefault();
    if (net !== null && !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(net.trim())) {
      error = "Enter the first three parts of your network, e.g. 192.168.1";
      return;
    }
    error = null;
    needSubnet = false;
    scanning = true;
    found = [];
    progress = { done: 0, total: 0 };
    handle = scan(net?.trim() ?? null, (p) => {
      progress = { done: p.done, total: p.total };
      found = p.found;
      if (p.finished) scanning = false;
    });
  }

  function stop() {
    handle?.cancel();
    handle = null;
    scanning = false;
  }

  async function pick(url: string) {
    stop();
    busy = true;
    error = await connectTo(url);
    busy = false;
  }

  onMount(begin);
  onDestroy(stop);
  const pct = $derived(progress.total ? Math.round((progress.done / progress.total) * 100) : 0);
</script>

<div class="absolute inset-0 grid place-items-center">
  <div class="w-[56rem]">
    <h1 class="text-center text-[2.8rem] font-bold">Find Ganymede on your network</h1>
    <p class="mt-2 mb-10 text-center text-on-surface-variant">
      Looking for Ganymede on ports 4800, 4000, 80 and 8080{subnet ? ` in ${subnet}.x` : ""}.
    </p>
    {#if needSubnet}
      <form class="flex flex-col gap-5" onsubmit={(e) => start(subnet, e)}>
        <label>
          <span class="field-label">Network to search (first three numbers of your TV's IP address)</span>
          <input class="field" bind:value={subnet} inputmode="decimal" placeholder="192.168.1" />
        </label>
        <div class="min-h-[1.6rem] text-center text-error">{error ?? ""}</div>
        <div class="flex justify-center gap-4">
          <Btn variant="filled" type="submit" data-autofocus="">Search</Btn>
          <Btn type="button" onclick={() => router.back()}>Back</Btn>
        </div>
      </form>
    {:else}
      <div class="mb-6 flex items-center gap-5 text-on-surface-variant">
        <div class="h-[0.45rem] flex-1 overflow-hidden rounded-full bg-surface-container-high">
          <div class="h-full bg-primary transition-[width] duration-300" style:width="{scanning ? pct : 100}%"></div>
        </div>
        <span>{scanning ? `Checked ${progress.done} of ${progress.total}` : `Search finished · ${found.length} found`}</span>
      </div>
      <div class="mb-4 flex min-h-24 flex-col gap-2.5" data-focus-group>
        {#each found as f, i (f.url)}
          <button
            class="tile group flex h-[4.8rem] items-center gap-5 px-[1.6rem] focus:scale-102"
            data-autofocus={i === 0 ? "" : undefined}
            disabled={busy}
            onclick={() => pick(f.url)}
          >
            <Icon name="server" size="2.2rem" />
            <span class="flex-1 text-[1.35rem] font-semibold" data-part="scan-addr">{f.url.replace(/^https?:\/\//, "")}</span>
            <span class="text-on-surface-variant group-focus:text-surface-container-high">{f.channels} channel{f.channels === 1 ? "" : "s"}</span>
          </button>
        {:else}
          <p class="p-4 text-center text-on-surface-variant">
            {scanning ? "Nothing yet…" : "No Ganymede servers answered. Check the TV and server are on the same network, or type the address instead."}
          </p>
        {/each}
      </div>
      <div class="min-h-[1.6rem] text-center text-error">{error ?? ""}</div>
      <div class="mt-3 flex justify-center gap-4">
        <Btn data-autofocus={found.length ? undefined : ""} onclick={() => (scanning ? stop() : begin())}>{scanning ? "Stop" : "Search again"}</Btn>
        <Btn onclick={() => router.back()}>Type an address</Btn>
      </div>
      <div class="mt-6 flex h-12 justify-center">{#if busy}<Spinner size="2.4rem" />{/if}</div>
    {/if}
  </div>
</div>
