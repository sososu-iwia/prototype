"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryItem } from "../../lib/api/types";
export type VideoLabels = Record<
  "playVideo" | "pauseVideo" | "videoBlocked" | "videoError",
  string
>;
export function GalleryVideo({
  item,
  title,
  priority = false,
  labels,
}: {
  item: GalleryItem;
  title: string;
  priority?: boolean;
  labels: VideoLabels;
}) {
  const p = (key: keyof VideoLabels) => labels[key];
  const ref = useRef<HTMLVideoElement>(null);
  const policy = useRef({
    inView: false,
    reduced: true,
    userPaused: false,
    internalPause: false,
    request: 0,
  });
  const [attached, setAttached] = useState(priority);
  const [autoAllowed, setAutoAllowed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [feedback, setFeedback] = useState<"blocked" | "error" | null>(null);
  const src =
    item.url === "/media/gallery1.mp4"
      ? "/media/gallery1-web-v1-960.mp4"
      : item.url;
  const pauseInternally = useCallback(() => {
    const video = ref.current;
    policy.current.request++;
    if (video && !video.paused) {
      policy.current.internalPause = true;
      video.pause();
    }
  }, []);
  const play = useCallback(
    (manual = false) => {
      const video = ref.current,
        current = policy.current;
      if (
        !video ||
        !current.inView ||
        document.hidden ||
        (!manual && (current.reduced || current.userPaused))
      )
        return;
      const request = ++current.request;
      void video.play().catch((error: DOMException) => {
        if (request !== policy.current.request || error.name === "AbortError")
          return;
        setAutoAllowed(false);
        setFeedback(error.name === "NotAllowedError" ? "blocked" : "error");
        pauseInternally();
      });
    },
    [pauseInternally],
  );
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      policy.current.reduced = reduced.matches;
      const allowed =
        policy.current.inView &&
        !document.hidden &&
        !reduced.matches &&
        !policy.current.userPaused;
      setAutoAllowed(allowed);
      if (allowed && video.getAttribute("src")) play();
      else if (document.hidden || reduced.matches || !policy.current.inView)
        pauseInternally();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        policy.current.inView =
          entry.isIntersecting && entry.intersectionRatio >= 0.2;
        if (policy.current.inView) setAttached(true);
        sync();
      },
      { threshold: [0, 0.2] },
    );
    observer.observe(video);
    sync();
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      pauseInternally();
    };
  }, [play, pauseInternally]);
  useEffect(() => {
    if (attached) play();
  }, [attached, play]);
  return (
    <>
      {priority && item.poster && (
        <link
          rel="preload"
          as="image"
          href={item.poster}
          fetchPriority="high"
        />
      )}
      <video
        className="gallery-video"
        ref={ref}
        src={attached ? src : undefined}
        poster={attached ? item.poster || undefined : undefined}
        autoPlay={autoAllowed && !feedback}
        muted
        loop
        playsInline
        controls
        preload="none"
        aria-label={title}
        onLoadedData={() => play()}
        onError={() => {
          setFeedback("error");
          setAutoAllowed(false);
        }}
        onPlay={() => {
          if (!policy.current.inView || document.hidden) {
            pauseInternally();
            return;
          }
          policy.current.userPaused = false;
          setFeedback(null);
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
          if (policy.current.internalPause)
            policy.current.internalPause = false;
          else if (!ref.current?.ended) {
            policy.current.userPaused = true;
            policy.current.request++;
            setAutoAllowed(false);
          }
        }}
        onVolumeChange={() => {
          const video = ref.current;
          if (video && !video.muted)
            document.querySelectorAll("video").forEach((other) => {
              if (other !== video && !other.muted) other.pause();
            });
        }}
      />
      <button
        type="button"
        className="gallery-video-toggle"
        aria-label={`${p(playing ? "pauseVideo" : "playVideo")}: ${title}`}
        onClick={() => {
          const video = ref.current;
          if (!video) return;
          if (!video.paused) {
            policy.current.userPaused = true;
            video.pause();
          } else {
            policy.current.userPaused = false;
            if (!video.getAttribute("src")) {
              video.src = src;
              setAttached(true);
            }
            if (video.error) video.load();
            setFeedback(null);
            play(true);
          }
        }}
      >
        {p(playing ? "pauseVideo" : "playVideo")}
      </button>
      {feedback && (
        <p className="gallery-video-feedback" role="status">
          {p(feedback === "blocked" ? "videoBlocked" : "videoError")}
        </p>
      )}
    </>
  );
}
