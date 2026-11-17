<script lang="ts">
  // Ganymede setup, step 1: type an address, use the default, or go scan the network.
  import Btn from "../components/Btn.svelte";
  import Spinner from "../components/Spinner.svelte";
  import Icon from "../components/Icon.svelte";
  import { ganymede } from "../ganymede/source.svelte";
  import { DEFAULT_GANYMEDE } from "../ganymede/base";
  import { connectTo, cancelSetup, canCancelSetup } from "../ganymede/setupFlow";
  import { router } from "../router.svelte";

  let address = $state(ganymede.url.replace(/^https:\/\//, "") || "");
  let error = $state<string | null>(ganymede.phase === "offline" ? `Can't reach ${ganymede.url}` : null);
  let busy = $state(false);
  const defaultLabel = DEFAULT_GANYMEDE.replace(/^https?:\/\//, "");
  const canCancel = canCancelSetup();

  async function connect(e?: Event, value = address) {
    e?.preventDefault();
    busy = true;
    error = await connectTo(value);
    busy = false;
  }

  const choice =
    "group grid grid-cols-[auto_1fr] grid-rows-[auto_auto] items-center gap-x-[1.1rem] rounded-[1.2rem] bg-surface-container px-[1.6rem] py-[1.4rem] text-left text-primary transition duration-150 ease-tv focus:scale-103 focus:bg-on-surface focus:text-primary-dim [&>svg]:row-span-2";
</script>

<div class="absolute inset-0 grid place-items-center">
  <div class="w-[56rem]">
    <h1 class="text-center text-[2.8rem] font-bold">Connect Ganymede</h1>
    <p class="mt-2 mb-10 text-center text-on-surface-variant">
      Type an address (a local one like <b class="text-on-surface">192.168.1.10:4800</b> works too), or pick an option below.
    </p>
    <form class="flex flex-col gap-5" onsubmit={connect} novalidate>
      <label>
        <span class="field-label">Server address</span>
        <input class="field" bind:value={address} type="text" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="192.168.1.10:4800" disabled={busy} />
      </label>
      <div class="min-h-[1.6rem] text-center text-error">{error ?? ""}</div>
      <div class="flex justify-center gap-4">
        <Btn type="submit" disabled={busy}>{busy ? "Connecting…" : "Connect"}</Btn>
        {#if canCancel}<Btn type="button" onclick={cancelSetup}>Cancel</Btn>{/if}
      </div>
    </form>
    <div class="mt-9 mb-6 flex items-center gap-4 text-dim before:h-[0.1rem] before:flex-1 before:bg-outline-variant after:h-[0.1rem] after:flex-1 after:bg-outline-variant">
      or
    </div>
    <div class="grid grid-cols-2 gap-5" data-focus-group>
      <button class={choice} data-focus-id="g-default" data-autofocus disabled={busy} onclick={() => connect(undefined, DEFAULT_GANYMEDE)}>
        <Icon name="live" size="2.2rem" />
        <span class="text-[1.3rem] font-bold text-on-surface group-focus:text-surface">Use the default</span>
        <span class="text-base text-on-surface-variant group-focus:text-surface">{defaultLabel}</span>
      </button>
      <button class={choice} data-focus-id="g-scan" disabled={busy} onclick={() => router.push({ name: "g-scan" })}>
        <Icon name="search" size="2.2rem" />
        <span class="text-[1.3rem] font-bold text-on-surface group-focus:text-surface">Scan for local servers</span>
        <span class="text-base text-on-surface-variant group-focus:text-surface">Find Ganymede on this TV's network</span>
      </button>
    </div>
    <div class="mt-8 flex h-12 justify-center">{#if busy}<Spinner size="2.4rem" />{/if}</div>
  </div>
</div>
