"use client";
import { useEffect } from "react";
export function ScrollEffects() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("show");
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    const elements = document.querySelectorAll(
      ".section-heading,.about-left,.about-right,.achievement-card,.main-news-card,.small-news-card,.gallery-item,.contact-container",
    );
    for (const el of elements) {
      if (el.getBoundingClientRect().top > innerHeight) {
        el.classList.add("reveal");
        observer.observe(el);
      }
    }
    return () => {
      observer.disconnect();
      for (const el of elements) {
        el.classList.remove("reveal", "show");
      }
    };
  }, []);
  return null;
}
