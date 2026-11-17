// Subtitle fonts. Anything but "System" is loaded from Google Fonts on demand; if the TV
// is offline the text simply falls back to the system font.

export const SUBTITLE_FONTS = [
  "System",
  "Roboto",
  "Open Sans",
  "Lato",
  "Noto Sans",
  "Inter",
  "Atkinson Hyperlegible",
  "Lexend",
  "Source Sans 3",
  "Merriweather",
  "Noto Serif",
  "Roboto Mono",
  "Comic Neue",
];

const loaded = new Set<string>();

export function loadFont(family: string) {
  if (!family || family === "System" || loaded.has(family)) return;
  loaded.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@500;700&display=swap`;
  document.head.appendChild(link);
}

export function fontStack(family: string): string {
  if (!family || family === "System") return `"Samsung One", Roboto, "Segoe UI", system-ui, sans-serif`;
  const generic = /serif/i.test(family) && !/sans/i.test(family) ? "serif" : /mono/i.test(family) ? "monospace" : "sans-serif";
  return `"${family}", ${generic}`;
}
