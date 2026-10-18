import manifest from "../../../../packages/content/media-manifest.json";
type Asset = {
  width: number;
  height: number;
  variants: { width: number; url: string; avif: string }[];
};
const assets = manifest as Record<string, Asset>;
export function Media({
  src,
  alt,
  priority = false,
  sizes = "(max-width: 600px) 90vw, (max-width: 950px) 45vw, 30vw",
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const asset =
    assets[src] ||
    Object.values(assets).find((a) =>
      a.variants.some((v) => v.url === src || v.avif === src),
    );
  if (!asset)
    return (
      <img
        src={src}
        alt={alt}
        width={960}
        height={640}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={className}
      />
    );
  const fallback =
    asset.variants.find((v) => v.width === 640) || asset.variants[0];
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={asset.variants.map((v) => `${v.avif} ${v.width}w`).join(", ")}
        sizes={sizes}
      />
      <img
        src={fallback.url}
        srcSet={asset.variants.map((v) => `${v.url} ${v.width}w`).join(", ")}
        sizes={sizes}
        alt={alt}
        width={asset.width}
        height={asset.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
