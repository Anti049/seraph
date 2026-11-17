// The inline bundle strategy embeds JS and CSS in index.html, but SvelteKit still writes the
// stylesheet to _app/immutable. Nothing references it, so drop it before packaging.
import { readFileSync, rmSync, existsSync } from "node:fs";

const html = readFileSync("build/index.html", "utf8");
if (existsSync("build/_app/immutable") && !html.includes("_app/immutable/")) {
  rmSync("build/_app/immutable", { recursive: true });
  console.log("pruned build/_app/immutable (inlined into index.html)");
}
