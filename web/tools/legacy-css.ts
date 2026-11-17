// Lowers Tailwind 4's CSS (which targets Chrome 111+) for old TV browsers.
// Samsung Tizen 6 (2021 TVs) runs Chromium 76 and Tizen 6.5 runs Chromium 85.
//  - postcss-preset-env (target chrome 76): flattens @layer, turns logical properties
//    (padding-inline, inset-inline, margin-inline…) into physical ones, and expands inset
//  - :where()/:is(): unwrapped into plain selector lists (Chrome 88)
//  - standalone translate/scale/rotate (Chrome 104): folded into one `transform`
//  - Firefox-only :-moz-* rules are dropped, because they'd invalidate whole selector lists
// oklch() (lunar-ui palettes) is converted to rgb; Tailwind's own color-mix()/lab() sit behind
// @supports with plain fallbacks.
import type { Declaration, Plugin, Rule } from "postcss";
import selectorParser from "postcss-selector-parser";
import presetEnv from "postcss-preset-env";
import type { DirectionFlow } from "postcss-logical";

type Sel = selectorParser.Selector;
const WRAPPERS = new Set([":where", ":is", ":-webkit-any", ":matches"]);

function expand(sel: Sel): Sel[] {
  let index = -1;
  let i = 0;
  sel.walkPseudos((p) => {
    if (index < 0 && WRAPPERS.has(p.value)) index = i;
    i++;
  });
  if (index < 0) return [sel];
  const out: Sel[] = [];
  const target = nth(sel, index);
  for (const alt of target.nodes as Sel[]) {
    const copy = sel.clone() as Sel;
    nth(copy, index).replaceWith(...(alt.clone() as Sel).nodes);
    out.push(...expand(copy));
  }
  return out;
}

function nth(sel: Sel, index: number): selectorParser.Pseudo {
  let found!: selectorParser.Pseudo;
  let i = 0;
  sel.walkPseudos((p) => {
    if (i++ === index) found = p;
  });
  return found;
}

const unwrapSelectors = (): Plugin => ({
  postcssPlugin: "seraph-unwrap-selectors",
  Rule(rule: Rule) {
    if (/:-moz-/.test(rule.selector)) {
      rule.remove();
      return;
    }
    if (!/:(where|is|-webkit-any|matches)\(/.test(rule.selector)) return;
    rule.selector = selectorParser((root) => {
      const sels: Sel[] = [];
      root.each((s) => void sels.push(...expand(s as Sel)));
      root.removeAll();
      for (const s of sels) root.append(s);
    }).processSync(rule.selector);
  },
});

const TRANSFORM =
  "translate(var(--tw-translate-x, 0), var(--tw-translate-y, 0)) rotate(var(--tw-legacy-rotate, 0deg)) scale(var(--tw-scale-x, 1), var(--tw-scale-y, 1))";

const foldTransforms = (): Plugin => ({
  postcssPlugin: "seraph-fold-transforms",
  Declaration: {
    // Transitions on the standalone properties now have to name `transform`.
    "transition-property"(decl: Declaration) {
      const props = decl.value.split(",").map((p) => p.trim());
      if (!props.some((p) => p === "translate" || p === "scale" || p === "rotate")) return;
      const next = [...new Set(props.map((p) => (p === "translate" || p === "scale" || p === "rotate" ? "transform" : p)))];
      decl.value = next.join(",");
    },
    // Each standalone property becomes the variables it stands for, plus the combined transform.
    // `none` resets its own part (lunar-ui's drawer opens with `translate: none`).
    translate(decl: Declaration) {
      const v = decl.value.trim();
      if (v === "none") {
        decl.cloneBefore({ prop: "--tw-translate-x", value: "0px" });
        decl.cloneBefore({ prop: "--tw-translate-y", value: "0px" });
      } else if (!/^var\(--tw-translate-x\)\s+var\(--tw-translate-y\)$/.test(v)) {
        const [x, y = "0px"] = postcssValueSplit(v);
        decl.cloneBefore({ prop: "--tw-translate-x", value: x });
        decl.cloneBefore({ prop: "--tw-translate-y", value: y });
      }
      decl.cloneBefore({ prop: "transform", value: TRANSFORM });
      decl.remove();
    },
    scale(decl: Declaration) {
      const v = decl.value.trim();
      if (v === "none") {
        decl.cloneBefore({ prop: "--tw-scale-x", value: "1" });
        decl.cloneBefore({ prop: "--tw-scale-y", value: "1" });
      } else if (!/^var\(--tw-scale-x\)\s+var\(--tw-scale-y\)$/.test(v)) {
        const [x, y = x] = postcssValueSplit(v);
        decl.cloneBefore({ prop: "--tw-scale-x", value: x });
        decl.cloneBefore({ prop: "--tw-scale-y", value: y });
      }
      decl.cloneBefore({ prop: "transform", value: TRANSFORM });
      decl.remove();
    },
    rotate(decl: Declaration) {
      decl.cloneBefore({ prop: "--tw-legacy-rotate", value: decl.value.trim() === "none" ? "0deg" : decl.value });
      decl.cloneBefore({ prop: "transform", value: TRANSFORM });
      decl.remove();
    },
  },
});

/** Split a value on top-level spaces (keeps calc(…)/var(…) whole). */
function postcssValueSplit(v: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of v) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export const legacyCss = () => [
  presetEnv({
    browsers: "chrome >= 76",
    stage: 2,
    logical: { inlineDirection: "left-to-right" as DirectionFlow, blockDirection: "top-to-bottom" as DirectionFlow },
    features: {
      "cascade-layers": true,
      "is-pseudo-class": false,
      // lunar-ui's palettes are oklch. Replace rather than keep both: they live in custom
      // properties, where an old browser accepts the oklch() token and then fails at use time.
      "oklab-function": { preserve: false },
      "color-functional-notation": { preserve: false },
    },
  }),
  unwrapSelectors(),
  foldTransforms(),
];
