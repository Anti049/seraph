<script lang="ts">
  import { account } from "#lib/account.svelte.ts";
  import { gate } from "#lib/gate.svelte.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Note from "#lib/components/settings/Note.svelte";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";
</script>

<PageHeader title="Plex" />
{#if account.token}
  <Note text="Signed in as " strong={account.user?.title || account.user?.username || "Plex user"} />
  <div class="mb-5 flex max-w-256 flex-col gap-2">
    {#each account.connected as s (s.machineId)}
      <div class="surface-container-low flex items-center gap-4 rounded-2xl px-5 py-3">
        <Icon name="server" size="1.8rem" />
        <span class="flex-1 truncate text-[1.2rem] font-semibold">{s.name}</span>
        <span class="badge badge-tonal badge-surface inline-flex rounded-md px-2.5 py-0.5 text-[0.9rem]">{s.local ? "On your network" : "Remote"}</span>
      </div>
    {/each}
    {#each account.unreachable as id (id)}
      <div class="surface-container-low flex items-center gap-4 rounded-2xl px-5 py-3 text-error">
        <Icon name="server" size="1.8rem" /><span class="flex-1">A chosen server isn't reachable right now</span>
      </div>
    {/each}
  </div>
  <div class="flex gap-4" data-focus-group>
    <Btn onclick={() => account.manageServers()}><Icon name="server" /> Choose servers</Btn>
    <Btn onclick={() => account.signOut()}><Icon name="logout" /> Sign out of Plex</Btn>
  </div>
{:else}
  <Note text="Not connected." />
  <div class="mt-5 flex gap-4" data-focus-group>
    <Btn variant="filled" onclick={() => gate.open({ name: "plex-signin" })}><Icon name="movie" /> Add Plex</Btn>
  </div>
{/if}
