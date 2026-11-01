import manifest from "../../../packages/content/editorial-hero.json";
const srcSet = (variants: typeof manifest.desktop, format: "avif" | "webp") =>
  variants.map((variant) => `${variant[format]} ${variant.width}w`).join(", ");
export const editorialHero = {
  width: manifest.width,
  height: manifest.height,
  mobileAvif: srcSet(manifest.mobile, "avif"),
  mobileWebp: srcSet(manifest.mobile, "webp"),
  desktopAvif: srcSet(manifest.desktop, "avif"),
  desktopWebp: srcSet(manifest.desktop, "webp"),
  mobileFallback: manifest.mobile.at(-1)!,
  desktopFallback: manifest.desktop.at(-1)!,
  // Account for cover scaling in a tall hero, not just the viewport width.
  mobileSizes: "570px",
  desktopSizes: "(max-width: 1000px) 1100px, 100vw",
};
