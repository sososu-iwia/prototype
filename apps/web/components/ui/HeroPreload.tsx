export function HeroPreload({
  team = false,
  priority = "high",
  editorial = false,
}: {
  team?: boolean;
  priority?: "high" | "low";
  editorial?: boolean;
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
            href={
              editorial
                ? "/media/hero-640.avif"
                : "/media/hero-background-640.avif"
            }
            media="(max-width: 600px)"
            fetchPriority={priority}
          />
          <link
            rel="preload"
            as="image"
            type="image/avif"
            href={
              editorial
                ? "/media/hero-1600.avif"
                : "/media/hero-background-1600.avif"
            }
            media="(min-width: 601px)"
            fetchPriority={priority}
          />
        </>
      )}
    </>
  );
}
