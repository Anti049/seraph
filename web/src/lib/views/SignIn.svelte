<script lang="ts">
  import Btn from "../components/Btn.svelte";
  import Logo from "../components/Logo.svelte";
  import Spinner from "../components/Spinner.svelte";
  import { onDestroy } from "svelte";
  import { account } from "../account.svelte";
  import { plexTv, type Pin } from "../plex";
  import { router } from "../router.svelte";
  import { gate } from "../gate.svelte";

  let pin = $state<Pin | null>(null);
  let error = $state<string | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let alive = true;

  async function newPin() {
    clearInterval(timer);
    clearTimeout(expiry);
    error = null;
    pin = null;
    try {
      pin = await plexTv.createPin();
    } catch (e) {
      error = `Couldn't reach plex.tv (${(e as Error).message}).`;
      return;
    }
    const id = pin.id;
    timer = setInterval(async () => {
      try {
        const p = await plexTv.checkPin(id);
        if (p.authToken && alive) {
          clearInterval(timer);
          await account.signedIn(p.authToken);
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    // Codes expire after ~15 minutes; quietly fetch a fresh one.
    expiry = setTimeout(newPin, Math.max(60, (pin.expiresIn ?? 900) - 30) * 1000);
  }

  newPin();
  onDestroy(() => {
    alive = false;
    clearInterval(timer);
    clearTimeout(expiry);
  });
</script>

<div class="absolute inset-0 grid grid-cols-[1.1fr_1fr] items-center gap-24 px-36">
  <div>
    <div class="mb-12 flex items-center gap-5">
      <Logo class="h-[4.6rem]" />
      <span class="text-[2.2rem] font-extrabold tracking-[0.06em]">SERAPH</span>
    </div>
    <h1 class="mb-8 text-5xl leading-[1.12] font-bold tracking-tight">Sign in with your Plex account</h1>
    <ol class="list-decimal pl-[1.6rem] text-[1.5rem] leading-[2] text-subtext">
      <li>On your phone or computer, go to <b class="text-primary">plex.tv/link</b></li>
      <li>Sign in to Plex if asked</li>
      <li>Enter the code shown here</li>
    </ol>
    <p class="mt-12 text-base text-dim">SERAPH is an independent app that plays media from your own Plex Media Server.</p>
  </div>
  <div class="flex flex-col items-center gap-8">
    {#if error}
      <p class="text-[1.3rem] text-error">{error}</p>
      <Btn variant="filled" data-autofocus="" onclick={newPin}>Try again</Btn>
    {:else if !pin}
      <Spinner />
    {:else}
      <div class="flex gap-4" aria-label="Link code">
        {#each pin.code.split("") as ch, i (i)}
          <span
            class="grid h-36 w-28 place-items-center rounded-[1.2rem] border-[0.15rem] border-outline-variant bg-surface-container text-[5rem] font-extrabold tabular-nums"
            >{ch}</span
          >
        {/each}
      </div>
      <div class="flex items-center gap-3 text-[1.2rem] text-on-surface-variant">
        <span class="size-[0.7rem] animate-pulse rounded-full bg-primary"></span>Waiting for you to enter the code…
      </div>
      <div class="flex gap-4">
        <Btn data-autofocus="" onclick={newPin}>Get a new code</Btn>
        <Btn onclick={() => router.back() || gate.finish()}>Cancel</Btn>
      </div>
    {/if}
  </div>
</div>
