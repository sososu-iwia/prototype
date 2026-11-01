import { editorialHero as hero } from "../../lib/hero-media";
export function HeroPreload({
  team = false,
  priority = "high",
  editorial = false,
}: {
  team?: boolean;
  priority?: "high" | "low";
  editorial?: boolean;
}) {
  if (editorial)
    return (
      <>
        <link
          rel="preload"
          as="image"
          type="image/avif"
          href={hero.mobileFallback.avif}
          imageSrcSet={hero.mobileAvif}
          imageSizes={hero.mobileSizes}
          media="(max-width:480px)"
          fetchPriority={priority}
        />
        <link
          rel="preload"
          as="image"
          type="image/avif"
          href={hero.desktopFallback.avif}
          imageSrcSet={hero.desktopAvif}
          imageSizes={hero.desktopSizes}
          media="(min-width:481px)"
          fetchPriority={priority}
        />
      </>
    );
  return (
    <>
      {team ? (
        <>
          <link
            rel="preload"
            as="image"
            type="image/avif"
            href="/media/gallery2-background-640.avif"
            media="(max-width: 600px)"
            fetchPriority={priority}
          />
          <link
            rel="preload"
            as="image"
            type="image/avif"
            href="/media/gallery2-background-960.avif"
            media="(min-width: 601px)"
            fetchPriority={priority}
          />
        </>
      ) : (
        <>
          <link
            rel="preload"
            as="image"
            type="image/avif"
            href="/media/hero-background-640.avif"
            media="(max-width: 600px)"
            fetchPriority={priority}
          />
          <link
            rel="preload"
            as="image"
            type="image/avif"
            href="/media/hero-background-1600.avif"
            media="(min-width: 601px)"
            fetchPriority={priority}
          />
        </>
      )}
    </>
  );
}
