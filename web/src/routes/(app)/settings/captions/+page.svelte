<script lang="ts">
  import { settings } from "#lib/settings.svelte.ts";
  import { SUBTITLE_FONTS } from "#lib/fonts.ts";
  import { captionStylePage } from "#lib/menus.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Choice from "#lib/components/settings/Choice.svelte";
  import SubtitleText from "#lib/components/SubtitleText.svelte";
  import MenuDrawer from "#lib/components/MenuDrawer.svelte";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";

  const isCustomFont = $derived(!SUBTITLE_FONTS.includes(settings.subFont));
  let customFont = $state(SUBTITLE_FONTS.includes(settings.subFont) ? "" : settings.subFont);
  const preview = ["The tide's coming in faster than we thought.", "We need to go — now."];
  let captionMenu = $state(false);
</script>

<PageHeader title="Captions" />
<div class="relative mb-6 h-[31.5rem] w-[56rem] overflow-hidden rounded-2xl" data-part="sub-preview" aria-hidden="true">
  <div
    class="absolute inset-0 bg-[radial-gradient(30rem_18rem_at_70%_30%,rgb(255_196_120/0.55),transparent_70%),radial-gradient(40rem_20rem_at_20%_90%,rgb(60_140_200/0.6),transparent_70%),linear-gradient(160deg,#3c4f63,#1c232c_60%,#0d1116)]"
  ></div>
  <SubtitleText lines={preview} scale={0.62} />
</div>
<div class="mb-5 flex gap-4" data-focus-group>
  <Btn variant="filled" data-focus-id="cap-style" onclick={() => (captionMenu = true)}><Icon name="tune" /> Caption style</Btn>
  <Btn onclick={() => settings.resetCaptions()}><Icon name="restart" /> Reset to default</Btn>
</div>
<form class="mb-4 flex items-center gap-3" onsubmit={(e) => (e.preventDefault(), customFont.trim() && settings.set("subFont", customFont.trim()))}>
  <span class="w-88 flex-none text-on-surface-variant">Any Google Font</span>
  <input class="field h-[2.8rem] w-xl text-[1.15rem]" bind:value={customFont} placeholder="e.g. Nunito, Fira Sans, Playfair Display" autocapitalize="words" spellcheck="false" />
  <button class={["chip", isCustomFont && "chip-on"]} type="submit">Use</button>
</form>
<Choice
  label="Rendering"
  opts={[
    { v: "styled" as const, l: "Styled (this app)" },
    { v: "burn" as const, l: "Burned in by server" },
  ]}
  value={settings.subRendering}
  pick={(v) => settings.set("subRendering", v)}
/>
<p class="text-dim">
  Font, colours, size, background, window and edge style work like YouTube's caption options, for text formats (SRT, ASS, WebVTT…).
  Image formats (PGS, VobSub) are always drawn by your server.
</p>
<MenuDrawer root={captionStylePage} bind:open={captionMenu} />
