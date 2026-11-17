<script lang="ts">
  // "Who's watching?": at launch when the TV has more than one profile, or from the side rail.
  import { profiles } from "../profiles.svelte";
  import { gate } from "../gate.svelte";
  import { router } from "../router.svelte";
  import Avatar from "../components/Avatar.svelte";
  import Icon from "../components/Icon.svelte";
  import Logo from "../components/Logo.svelte";

  /** Another profile reloads the app under it; the current one just carries on. */
  function choose(id: string) {
    if (!profiles.use(id)) gate.keepProfile();
  }
</script>

<div class="absolute inset-0 flex flex-col items-center justify-center gap-12">
  <div class="flex flex-col items-center gap-4">
    <Logo class="h-20" />
    <h1 class="text-5xl font-bold tracking-tight">Who's watching?</h1>
    <p class="text-[1.2rem] text-on-surface-variant">Pick your profile.</p>
  </div>
  <div class="flex flex-wrap justify-center gap-10" data-focus-group>
    {#each profiles.list as p (p.id)}
      <button
        class="group flex w-44 flex-col items-center gap-4 rounded-3xl p-4 transition duration-150 ease-tv focus:scale-108"
        data-focus-id="profile-{p.id}"
        data-autofocus={p.id === profiles.activeId ? "" : undefined}
        onclick={() => choose(p.id)}
      >
        <Avatar name={p.name} color={p.color} class="size-32 text-[3.4rem] group-focus:shadow-ring" />
        <span class="max-w-full truncate text-[1.3rem] font-semibold text-on-surface-variant group-focus:text-on-surface">{p.name}</span>
      </button>
    {/each}
    <button
      class="group flex w-44 flex-col items-center gap-4 rounded-3xl p-4 transition duration-150 ease-tv focus:scale-108"
      data-focus-id="profile-add"
      onclick={() => router.push({ name: "profile-new" })}
    >
      <span class="grid size-32 place-items-center rounded-full border-[0.2rem] border-dashed border-outline text-on-surface-variant group-focus:border-on-surface group-focus:text-on-surface">
        <Icon name="person-add" size="3rem" />
      </span>
      <span class="text-[1.3rem] font-semibold text-on-surface-variant group-focus:text-on-surface">Add profile</span>
    </button>
  </div>
</div>
