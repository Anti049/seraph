<script lang="ts">
  import PageHeader from "../components/PageHeader.svelte";
  import { onDestroy } from "svelte";
  import { api, ApiError, media, QUEUE_TASKS, type QueueItem } from "../ganymede/api";
  import { gApiKey } from "../ganymede/base";
  import { ganymede } from "../ganymede/source.svelte";
  import { router } from "../router.svelte";
  import { relative } from "../format";
  import Icon from "../components/Icon.svelte";
  import Btn from "../components/Btn.svelte";
  import Spinner from "../components/Spinner.svelte";

  const filters = [
    { id: "queued,running,finalizing,failed", label: "Active & failed" },
    { id: "queued,running,finalizing", label: "Active" },
    { id: "failed", label: "Failed" },
  ];
  let filter = $state(filters[0].id);
  let items = $state<QueueItem[] | null>(null);
  let error = $state<string | null>(null);
  let note = $state<string | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;
  let seq = 0;

  async function load() {
    const my = ++seq;
    try {
      const q = (await api.queue(filter)) ?? [];
      if (my !== seq) return;
      items = q.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      error = null;
    } catch (e) {
      if (my !== seq) return;
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        error =
          ganymede.mode === "local" && !gApiKey()
            ? "This TV can't use your Ganymede login for the queue. Add an API key with queue access in Settings → Ganymede."
            : "The queue needs a Ganymede account with the Archiver role (or higher), or an API key with queue access in Settings → Ganymede.";
      } else error = (e as Error).message;
    }
  }

  $effect(() => {
    filter;
    items = null;
    load();
    clearInterval(timer);
    timer = setInterval(load, 5000);
  });
  onDestroy(() => clearInterval(timer));

  function tasksFor(q: QueueItem) {
    return QUEUE_TASKS.filter((t) => {
      if (!t.chat) return true;
      if (!q.archive_chat) return false;
      if (t.key === "task_chat_render" && !q.render_chat) return false;
      return true;
    }).map((t) => ({ ...t, status: String(q[t.key] ?? "pending") }));
  }

  function overall(q: QueueItem) {
    const tasks = tasksFor(q);
    if (tasks.some((t) => t.status === "failed")) return "failed";
    if (q.on_hold) return "on hold";
    if (tasks.some((t) => t.status === "running")) return "running";
    if (tasks.every((t) => t.status === "success")) return "finishing";
    return "queued";
  }

  async function retry(q: QueueItem) {
    const failed = tasksFor(q).find((t) => t.status === "failed");
    if (!failed) return;
    try {
      await api.retryTask(q.id, failed.key);
      note = `Restarted “${failed.label}”`;
    } catch (e) {
      note = e instanceof ApiError && (e.status === 401 || e.status === 403) ? "Retrying needs queue write access." : (e as Error).message;
    }
    setTimeout(() => (note = null), 3000);
    load();
  }

  // lunar-ui badge colours per state (tonal = the role's container colours)
  const STATE: Record<string, string> = { running: "badge-primary", failed: "badge-error", "on hold": "badge-warning" };
  const TASK: Record<string, string> = { success: "badge-success", running: "badge-primary", failed: "badge-error font-bold" };
</script>

<div class="page" data-scroll-y>
  <PageHeader title="Queue" subtitle="Ganymede · updates every 5 s">
    {#snippet trailing()}
      {#each filters as f (f.id)}
        <button class={["chip", filter === f.id && "chip-on"]} data-focus-id="qf-{f.label}" onclick={() => (filter = f.id)}>{f.label}</button>
      {/each}
    {/snippet}
  </PageHeader>
  {#if note}<div class="-mt-3 mb-6 text-primary">{note}</div>{/if}

  {#if error}
    <div class="empty-state">{error}</div>
  {:else if !items}
    <Spinner />
  {:else if !items.length}
    <div class="empty-state">Nothing in the queue. New archives and live recordings will show up here.</div>
  {:else}
    <div class="flex max-w-400 flex-col gap-3">
      {#each items as q (q.id)}
        {@const vod = q.edges?.vod}
        {@const state = overall(q)}
        <div class="flex items-center gap-5" data-focus-group>
          <button
            class="surface-container flex min-w-0 flex-1 gap-6 rounded-2xl p-4 text-left transition duration-150 ease-tv focus:bg-surface-container-high focus:shadow-[0_0_0_0.2rem_var(--theme-color-on-surface)]"
            data-focus-id="q-{q.id}"
            onclick={() => vod && router.push({ name: "g-video", id: vod.id })}
          >
            <div class="relative h-36 w-64 flex-none overflow-hidden rounded-[0.6rem] bg-surface-container-high">
              {#if vod?.web_thumbnail_path}<img class="size-full object-cover" src={media(vod.web_thumbnail_path)} alt="" loading="lazy" />{/if}
              {#if q.live_archive}
                <span class="badge badge-filled badge-error absolute! top-2 left-2 rounded-[0.35rem] px-2 py-0.5 text-[0.85rem] font-bold">● LIVE</span>
              {/if}
            </div>
            <div class="min-w-0 flex-1 pt-1">
              <div class="truncate text-[1.35rem] font-semibold">{vod?.title ?? "Untitled"}</div>
              <div class="mt-1 flex items-center gap-1.5 text-on-surface-variant">
                {vod?.edges?.channel?.display_name ?? ""}{vod?.edges?.channel ? " · " : ""}added {relative(q.created_at)}
                <span class={["badge badge-tonal ml-3 rounded-md px-2.5 py-px text-[0.9rem] font-bold capitalize", STATE[state] ?? "badge-surface"]}>
                  {state}
                </span>
              </div>
              <div class="mt-3.5 flex flex-wrap gap-2">
                {#each tasksFor(q) as t (t.key)}
                  <span class={["badge badge-tonal gap-1.5 rounded-full px-3 py-1 text-[0.92rem]", TASK[t.status] ?? "badge-surface"]} title={t.status}>
                    {#if t.status === "success"}<Icon name="check" size="1.05rem" />
                    {:else if t.status === "failed"}✕
                    {:else}<span class={["size-[0.55rem] rounded-full bg-current opacity-60", t.status === "running" && "animate-pulse"]}></span>{/if}
                    {t.label}
                  </span>
                {/each}
              </div>
            </div>
          </button>
          {#if state === "failed"}
            <Btn data-focus-id="qr-{q.id}" onclick={() => retry(q)}><Icon name="restart" /> Retry</Btn>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
