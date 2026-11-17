<script lang="ts">
  import { profiles, PROFILE_COLORS } from "#lib/profiles.svelte.ts";
  import { gate } from "#lib/gate.svelte.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Note from "#lib/components/settings/Note.svelte";
  import Avatar from "#lib/components/Avatar.svelte";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";

  let editing = $state<string | null>(null);
  let editName = $state("");
  const nextColor = (c: string) => PROFILE_COLORS[(PROFILE_COLORS.indexOf(c) + 1) % PROFILE_COLORS.length];
</script>

<PageHeader title="Profiles" />
<Note text="Each profile has its own Plex and Ganymede sign-ins, settings, library menu and watch progress." />
<div class="mb-5 flex max-w-256 flex-col gap-2">
  {#each profiles.list as p (p.id)}
    <div class="surface-container-low flex items-center gap-4 rounded-2xl px-4 py-3" data-focus-group>
      <Avatar name={p.name} color={p.color} class="size-14 text-[1.6rem]" />
      {#if editing === p.id}
        <form class="flex flex-1 items-center gap-3" onsubmit={(e) => (e.preventDefault(), profiles.rename(p.id, editName), (editing = null))}>
          <input class="field h-[2.8rem] flex-1 text-[1.15rem]" bind:value={editName} maxlength="24" data-autofocus />
          <button class="chip" type="submit">Save</button>
        </form>
      {:else}
        <span class="flex-1 truncate text-[1.25rem] font-semibold">{p.name}{p.id === profiles.activeId ? " (this profile)" : ""}</span>
        <button class="chip" data-focus-id="prof-rename-{p.id}" onclick={() => ((editing = p.id), (editName = p.name))}>Rename</button>
        <button class="chip gap-2" data-focus-id="prof-color-{p.id}" onclick={() => profiles.setColor(p.id, nextColor(p.color))}>
          <span class="size-[1.1rem] rounded-full" style:background={p.color}></span> Colour
        </button>
        {#if p.id !== profiles.activeId}
          <button class="chip" data-focus-id="prof-use-{p.id}" onclick={() => profiles.use(p.id)}>Switch</button>
          {#if p.id !== "main"}<button class="chip text-error" data-focus-id="prof-del-{p.id}" onclick={() => profiles.remove(p.id)}>Remove</button>{/if}
        {/if}
      {/if}
    </div>
  {/each}
</div>
<div class="flex gap-4" data-focus-group>
  <Btn onclick={() => gate.open({ name: "profile-new" })}><Icon name="person-add" /> Add a profile</Btn>
</div>
