import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { legacyCss } from "./tools/legacy-css.ts";
import pkg from "./package.json" with { type: "json" };

// SERAPH ships INSIDE the TV apps (Android assets / Samsung widget), so the build is a
// single self-contained index.html:
//  - hash router: works from file:// (Tizen) and any path the Android shell serves it at
//  - inline bundle: JS and CSS embedded in index.html (module scripts can't be fetched from file://)
//  - relative paths and an old-Chromium target (Tizen 6 = Chromium 76)
export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
      },
      adapter: adapter({ fallback: "index.html" }),
      router: { type: "hash" },
      output: { bundleStrategy: "inline" },
      paths: { relative: true },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Where error reports and update checks go (owner/repo).
    __SERAPH_REPO__: JSON.stringify(process.env.SERAPH_REPO || "Anti049/seraph"),
    __GANYMEDE_DEFAULT__: JSON.stringify((process.env.GANYMEDE_DEFAULT || "https://ganymede.nploetz.dev").replace(/\/+$/, "")),
  },
  css: { postcss: { plugins: legacyCss() } },
  build: {
    // Fonts are inlined too: separate font files can be blocked when the page runs from file://.
    assetsInlineLimit: (file) => (file.endsWith(".woff2") ? true : undefined),
    target: ["chrome76"],
    cssTarget: ["chrome76"],
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true, port: 5173 },
});
