export function HeroPreload({
  team = false,
  priority = "high",
}: {
  team?: boolean;
  priority?: "high" | "low";
}) {
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
