<script lang="ts">
  import Logo from "../components/Logo.svelte";
  import Icon from "../components/Icon.svelte";
  import { router } from "../router.svelte";
  import { ganymede } from "../ganymede/source.svelte";

  const choices = [
    { id: "plex", route: "plex-signin", icon: "movie", name: "Plex", desc: "Movies and shows from your Plex Media Server. Sign in with a code at plex.tv/link." },
    { id: "ganymede", route: "g-setup", icon: "live", name: "Ganymede", desc: "Archived Twitch streams with chat replay. Enter your Ganymede address." },
  ] as const;
</script>

<div class="absolute inset-0 flex flex-col items-center justify-center gap-14">
  <div class="flex flex-col items-center gap-4 text-center">
    <Logo class="h-28" />
    <h1 class="text-5xl font-bold tracking-tight">Welcome to SERAPH</h1>
    <p class="text-[1.3rem] text-on-surface-variant">Add a library to get started. You can add the other one later in Settings.</p>
  </div>
  <div class="flex gap-8" data-focus-group>
    {#each choices as c, i (c.id)}
      <button
        class="group flex w-120 flex-col items-start gap-3 rounded-[1.4rem] bg-surface-container p-[2.4rem] text-left text-primary transition duration-[180ms] ease-tv focus:scale-104 focus:bg-on-surface focus:text-primary-dim"
        data-focus-id="welcome-{c.id}"
        data-autofocus={i === 0 ? "" : undefined}
        onclick={() => router.push({ name: c.route })}
      >
        <Icon name={c.icon} size="3rem" />
        <span class="text-[2rem] font-extrabold text-on-surface group-focus:text-surface">{c.name}</span>
        <span class="text-[1.1rem] leading-[1.45] text-on-surface-variant group-focus:text-surface">{c.desc}</span>
      </button>
    {/each}
  </div>
  {#if ganymede.phase === "offline"}
    <p class="text-[1.1rem] text-error">Couldn't reach your Ganymede server at {ganymede.url}. Choose Ganymede to retry or change the address.</p>
  {/if}
</div>
