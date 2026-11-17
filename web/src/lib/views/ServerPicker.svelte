<script lang="ts">
  // Choose which Plex servers to use; several can be on at once.
  import { account } from "../account.svelte";
  import Icon from "../components/Icon.svelte";
  import Btn from "../components/Btn.svelte";
  import Spinner from "../components/Spinner.svelte";
  import type { Resource } from "../plex";

  let busy = $state<string | null>(null);

  async function toggle(r: Resource) {
    if (busy) return;
    if (account.isConnected(r.clientIdentifier)) return account.remove(r.clientIdentifier);
    busy = r.clientIdentifier;
    await account.add(r);
    busy = null;
  }

  function done() {
    account.doneChoosing(); // the root layout leaves this screen once Plex is ready
  }
</script>

<div class="absolute inset-0 flex flex-col items-center justify-center bg-surface">
  <h1 class="text-[2.8rem] font-bold">Choose your Plex servers</h1>
  <p class="mt-2 mb-10 text-on-surface-variant">
    {account.user ? `Signed in as ${account.user.title || account.user.username} · ` : ""}Turn on every server you want to watch from. Their libraries are combined.
  </p>
  {#if account.phase === "connecting" && !account.resources.length}
    <Spinner label="Looking for servers…" />
  {:else}
    <div class="flex w-200 flex-col gap-3" data-focus-group>
      {#each account.resources as r, i (r.clientIdentifier)}
        {@const on = account.isConnected(r.clientIdentifier)}
        <button
          class="tile group flex h-[5.6rem] items-center gap-6 px-7 focus:scale-103"
          data-autofocus={i === 0 ? "" : undefined}
          data-focus-id="srv-{r.clientIdentifier}"
          onclick={() => toggle(r)}
          aria-pressed={on}
        >
          <Icon name="server" size="2.4rem" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-[1.45rem] font-semibold">{r.name}</span>
            <span class="text-base text-on-surface-variant group-focus:text-surface-container-high">
              {r.owned ? "Your server" : "Shared with you"}{r.presence === false ? " · offline" : ""}{account.unreachable.includes(r.clientIdentifier) ? " · unreachable" : ""}
            </span>
          </span>
          {#if busy === r.clientIdentifier}
            <Spinner size="2rem" />
          {:else}
            <span class={["relative h-8 w-14 flex-none rounded-full transition-colors", on ? "bg-primary" : "bg-surface-container-highest"]}>
              <span class={["absolute top-1 size-6 rounded-full bg-white transition-[left]", on ? "left-7" : "left-1"]}></span>
            </span>
          {/if}
        </button>
      {/each}
    </div>
    {#if account.error}<p class="mt-5 text-error">{account.error}</p>{/if}
    <div class="mt-10 flex gap-4" data-focus-group>
      <Btn variant="filled" disabled={!account.connected.length} onclick={done}>
        <Icon name="check" /> Done{account.connected.length ? ` (${account.connected.length})` : ""}
      </Btn>
      <Btn onclick={() => account.refreshResources()}><Icon name="refresh" /> Refresh</Btn>
      <Btn onclick={() => account.signOut()}><Icon name="logout" /> Sign out of Plex</Btn>
    </div>
  {/if}
</div>
