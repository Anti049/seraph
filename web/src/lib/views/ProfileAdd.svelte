<script lang="ts">
  // New profile: name it, then the app reloads under it.
  import { profiles } from "../profiles.svelte";
  import { router } from "../router.svelte";
  import Icon from "../components/Icon.svelte";
  import Btn from "../components/Btn.svelte";
  import Logo from "../components/Logo.svelte";

  let name = $state("");

  function add(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    profiles.use(profiles.add(name).id);
  }
</script>

<div class="absolute inset-0 flex flex-col items-center justify-center gap-12">
  <div class="flex flex-col items-center gap-4">
    <Logo class="h-20" />
    <h1 class="text-5xl font-bold tracking-tight">Add a profile</h1>
    <p class="text-[1.2rem] text-on-surface-variant">Each profile has its own Plex and Ganymede sign-ins, settings and progress.</p>
  </div>
  <form class="flex w-[44rem] flex-col gap-6" onsubmit={add}>
    <label>
      <span class="field-label">Name</span>
      <input class="field" bind:value={name} maxlength="24" autocapitalize="words" spellcheck="false" data-autofocus />
    </label>
    <div class="flex justify-center gap-4" data-focus-group>
      <Btn variant="filled" type="submit"><Icon name="check" /> Create and switch</Btn>
      <Btn type="button" onclick={() => router.back()}>Cancel</Btn>
    </div>
  </form>
</div>
