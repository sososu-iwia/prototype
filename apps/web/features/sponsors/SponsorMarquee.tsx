"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Sponsor } from "../../lib/api/types";

type Labels = { partners: string; pause: string; resume: string };
function Logo({
  item,
  duplicate = false,
}: {
  item: Sponsor;
  duplicate?: boolean;
}) {
  const image = (
    <img
      src={item.logo}
      alt={duplicate ? "" : item.name}
      width="240"
      height="100"
      loading="lazy"
    />
  );
  return (
    <li className="sponsor-logo">
      {item.websiteUrl && !duplicate ? (
        <a
          href={item.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.name}
        >
          {image}
        </a>
      ) : (
        image
      )}
    </li>
  );
}
export function SponsorMarquee({
  items,
  labels,
}: {
  items: Sponsor[];
  labels: Labels;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const unit = useRef<HTMLUListElement>(null);
  const [geometry, setGeometry] = useState({ repeats: 1, distance: 0 });
  const [paused, setPaused] = useState(false);
  useLayoutEffect(() => {
    if (items.length < 2 || !viewport.current || !unit.current) return;
    const measure = () => {
      const width = unit.current?.getBoundingClientRect().width || 0;
      if (!width) return;
      // A whole number of complete sets includes the trailing gap. Both halves
      // are identical; the reset therefore replaces every pixel with its twin.
      const repeats = Math.max(
        1,
        Math.ceil(Math.max(viewport.current!.clientWidth, 1560) / width),
      );
      const distance = width * repeats;
      setGeometry((previous) =>
        previous.repeats === repeats && previous.distance === distance
          ? previous
          : { repeats, distance },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport.current);
    observer.observe(unit.current);
    measure();
    return () => observer.disconnect();
  }, [items.length]);
  if (items.length < 2)
    return (
      <ul className="sponsor-grid sponsor-static" aria-label={labels.partners}>
        {items.map((item) => (
          <Logo item={item} key={item.id} />
        ))}
      </ul>
    );
  const style = {
    "--sponsor-distance": `${geometry.distance}px`,
    "--sponsor-duration": `${geometry.distance / 52}s`,
  } as CSSProperties;
  return (
    <div
      className="sponsor-marquee"
      data-ready={geometry.distance > 0}
      data-static={paused}
      style={style}
    >
      <div
        className="sponsor-marquee-viewport"
        ref={viewport}
        role="region"
        aria-label={labels.partners}
        tabIndex={0}
      >
        <div className="sponsor-marquee-track">
          {[0, 1].map((half) => (
            <div
              className="sponsor-marquee-segment"
              key={half}
              aria-hidden={half === 1 || undefined}
              inert={half === 1 || undefined}
            >
              {Array.from({ length: geometry.repeats }, (_, repeat) => {
                const duplicate = half > 0 || repeat > 0;
                return (
                  <ul
                    className="sponsor-marquee-set"
                    key={repeat}
                    ref={duplicate ? undefined : unit}
                    aria-label={duplicate ? undefined : labels.partners}
                    aria-hidden={duplicate || undefined}
                    inert={duplicate || undefined}
                  >
                    {items.map((item) => (
                      <Logo key={item.id} item={item} duplicate={duplicate} />
                    ))}
                  </ul>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="sponsor-motion-toggle"
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? labels.resume : labels.pause}
      </button>
    </div>
  );
}
