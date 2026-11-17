<script lang="ts">
  // Ganymede setup, last step: sign in, or browse without an account.
  import Btn from "../components/Btn.svelte";
  import { ganymede } from "../ganymede/source.svelte";
  import { gate } from "../gate.svelte";
  import { router } from "../router.svelte";

  let username = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function login(e?: Event) {
    e?.preventDefault();
    if (!username || !password) {
      error = "Enter your Ganymede username and password.";
      return;
    }
    busy = true;
    error = null;
    try {
      await ganymede.login(username, password);
      gate.finish();
    } catch (err) {
      error = (err as Error).message || "Sign-in failed";
    } finally {
      busy = false;
    }
  }

  function guest() {
    ganymede.browseAsGuest();
    gate.finish();
  }

  /** "Change server" goes back to the address step (it's below this one in history when there). */
  function changeServer() {
    if (router.stack.at(-2)?.route.name === "g-setup") router.back();
    else router.replace({ name: "g-setup" });
  }
</script>

<div class="absolute inset-0 grid place-items-center">
  <div class="w-[56rem]">
    <h1 class="text-center text-[2.8rem] font-bold">Sign in to Ganymede</h1>
    <p class="mt-2 mb-10 text-center text-on-surface-variant">{ganymede.url.replace(/^https?:\/\//, "")}</p>
    <form class="flex flex-col gap-5" onsubmit={login}>
      <label>
        <span class="field-label">Username</span>
        <input class="field" bind:value={username} autocomplete="username" autocapitalize="off" spellcheck="false" data-autofocus disabled={busy} />
      </label>
      <label>
        <span class="field-label">Password</span>
        <input class="field" bind:value={password} type="password" autocomplete="current-password" disabled={busy} />
      </label>
      <div class="min-h-[1.6rem] text-center text-error">{error ?? ""}</div>
      <div class="flex justify-center gap-4">
        <Btn variant="filled" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Btn>
        <Btn type="button" onclick={guest}>Browse without signing in</Btn>
        <Btn type="button" onclick={changeServer}>Change server</Btn>
      </div>
    </form>
    <p class="mt-8 text-center text-[0.95rem] text-dim">Signing in keeps track of what you've watched. SSO-only accounts need a local password in Ganymede.</p>
  </div>
</div>
