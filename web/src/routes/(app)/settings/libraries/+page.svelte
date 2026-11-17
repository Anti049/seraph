<script lang="ts">
  import { tick } from "svelte";
  import { libraries, LIBRARY_ICONS } from "#lib/libraries.svelte.ts";
  import { focusById } from "#lib/nav.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Note from "#lib/components/settings/Note.svelte";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";

  // Focus ids can't contain ":" safely in selectors, so library ids are made id-safe.
  const fid = (id: string) => id.replace(/[^\w-]/g, "_");
  let pickerFor = $state<string | null>(null);

  async function openPicker(id: string) {
    pickerFor = pickerFor === id ? null : id;
    await tick();
    if (pickerFor) focusById(`icon-${fid(id)}-${libraries.all.find((l) => l.id === id)?.icon}`);
  }
  async function chooseIcon(id: string, icon: string) {
    libraries.setIcon(id, icon);
    pickerFor = null;
    await tick();
    focusById(`libicon-${fid(id)}`);
  }
  async function move(id: string, dir: -1 | 1, from: string) {
    libraries.move(id, dir);
    await tick();
    // keep focus on the same button as the row moves (or its neighbour if it just became disabled)
    if (!focusById(`${from}-${fid(id)}`)) focusById(`${from === "libup" ? "libdown" : "libup"}-${fid(id)}`);
  }
</script>

<PageHeader title="Plex libraries" />
<Note text="Pick which libraries appear in the side menu, their order and icons. Hidden ones stay under “All libraries”." />
<div class="flex max-w-256 flex-col gap-2" data-part="libs">
  {#each libraries.all as l, i (l.id)}
    {@const k = fid(l.id)}
    <div class="surface-container-low flex items-center gap-3 rounded-2xl px-3 py-2.5" data-focus-group>
      <button
        class={[
          "grid size-[3.6rem] place-items-center rounded-xl bg-surface-container text-primary transition duration-150 ease-tv focus:scale-108 focus:bg-primary focus:text-on-primary",
          l.hidden && "opacity-50",
        ]}
        data-focus-id="libicon-{k}"
        onclick={() => openPicker(l.id)}
        aria-label="Change icon"
      >
        <Icon name={l.icon} size="2rem" />
      </button>
      <div class={["flex min-w-0 flex-1 flex-col text-[1.2rem] font-semibold", l.hidden && "opacity-50"]}>
        <span class="truncate">{l.section.title}</span>
        <span class="text-[0.95rem] font-normal text-on-surface-variant">
          {l.section.type === "show" ? "TV shows" : "Movies"}{l.serverName ? ` · ${l.serverName}` : ""}
        </span>
      </div>
      <button class={["chip gap-1.5", !l.hidden && "chip-on"]} data-focus-id="libshow-{k}" onclick={() => libraries.toggle(l.id)}>
        <Icon name={l.hidden ? "visibility-off" : "visibility"} size="1.3rem" />
        {l.hidden ? "Hidden" : "Shown"}
      </button>
      <button class="chip w-[2.6rem] justify-center px-0 disabled:opacity-30" data-focus-id="libup-{k}" disabled={i === 0} onclick={() => move(l.id, -1, "libup")} aria-label="Move up">
        <Icon name="arrow-upward" size="1.4rem" />
      </button>
      <button
        class="chip w-[2.6rem] justify-center px-0 disabled:opacity-30"
        data-focus-id="libdown-{k}"
        disabled={i === libraries.all.length - 1}
        onclick={() => move(l.id, 1, "libdown")}
        aria-label="Move down"
      >
        <Icon name="arrow-downward" size="1.4rem" />
      </button>
    </div>
    {#if pickerFor === l.id}
      <div class="surface-container -mt-0.5 mb-1.5 ml-[4.4rem] flex flex-wrap gap-2 rounded-2xl p-3" data-focus-group>
        {#each LIBRARY_ICONS as ic (ic)}
          <button
            class={[
              "grid size-[3.4rem] place-items-center rounded-[0.7rem] focus:bg-inverse-surface focus:text-on-inverse-surface",
              l.icon === ic ? "inset-ring-[0.12rem] inset-ring-primary text-primary" : "text-on-surface",
            ]}
            data-focus-id="icon-{k}-{ic}"
            onclick={() => chooseIcon(l.id, ic)}
            aria-label={ic}
          >
            <Icon name={ic} size="2rem" />
          </button>
        {/each}
      </div>
    {/if}
  {/each}
</div>
<div class="mt-5 flex gap-4" data-focus-group>
  <Btn onclick={() => libraries.reset()}>Reset to defaults</Btn>
</div>
