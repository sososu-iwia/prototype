export function HeroPreload({ team = false }: { team?: boolean }) {
  return (
    <>
      {team ? (
        <>
          <link
            rel="preload"
            as="image"
            href="/media/gallery2-640.webp"
            media="(max-width: 600px)"
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            href="/media/gallery2-960.webp"
            media="(min-width: 601px)"
            fetchPriority="high"
          />
        </>
      ) : (
        <>
          <link
            rel="preload"
            as="image"
            href="/media/hero-640.webp"
            media="(max-width: 600px)"
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            href="/media/hero-1600.webp"
            media="(min-width: 601px)"
            fetchPriority="high"
          />
        </>
      )}
    </>
  );
}
