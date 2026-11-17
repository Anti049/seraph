<script lang="ts">
  import { ganymede } from "#lib/ganymede/source.svelte.ts";
  import { gate } from "#lib/gate.svelte.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Note from "#lib/components/settings/Note.svelte";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";

  let apiKeyInput = $state("");
  let apiKeySaved = $state(false);
</script>

<PageHeader title="Ganymede" />
{#if ganymede.phase !== "off"}
  <Note text="Server: " strong={ganymede.url.replace(/^https?:\/\//, "")} tag={ganymede.phase === "offline" ? "Unreachable" : undefined} bad />
  <Note
    text={ganymede.user
      ? `${ganymede.mode === "server" ? "Watch progress syncs with Ganymede" : "Watch progress is saved on this TV"} · signed in as `
      : "Browsing without an account; watch progress isn't saved."}
    strong={ganymede.user?.username}
  />
  <div class="mt-5 flex gap-4" data-focus-group>
    {#if ganymede.user}
      <Btn onclick={() => ganymede.logout()}><Icon name="logout" /> Sign out</Btn>
    {:else}
      <Btn onclick={() => gate.open({ name: "g-signin" })}><Icon name="account" /> Sign in</Btn>
    {/if}
    <Btn onclick={() => gate.open({ name: "g-setup" })}><Icon name="server" /> Change server</Btn>
    <Btn onclick={() => ganymede.disconnect()}>Remove Ganymede</Btn>
  </div>
  <form class="mt-5 flex items-center gap-3" onsubmit={(e) => (e.preventDefault(), ganymede.setApiKey(apiKeyInput), (apiKeySaved = true))}>
    <span class="w-88 flex-none text-on-surface-variant">API key (for the Queue tab)</span>
    <input
      class="field h-[2.8rem] w-xl text-[1.15rem]"
      bind:value={apiKeyInput}
      placeholder={ganymede.apiKey ? "•••••••• saved" : "Optional: Ganymede → Admin → API keys"}
      autocapitalize="off"
      spellcheck="false"
    />
    <button class="chip" type="submit">{apiKeySaved ? "Saved" : "Save"}</button>
    {#if ganymede.apiKey}<button class="chip" type="button" onclick={() => (ganymede.setApiKey(""), (apiKeyInput = ""))}>Clear</button>{/if}
  </form>
{:else}
  <Note text="Not connected." />
  <div class="mt-5 flex gap-4" data-focus-group>
    <Btn variant="filled" onclick={() => gate.open({ name: "g-setup" })}><Icon name="live" /> Add Ganymede</Btn>
  </div>
{/if}
