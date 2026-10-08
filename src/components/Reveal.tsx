import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Motion.module.css";

export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = element.current;
    if (!node || typeof IntersectionObserver !== "function") return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || node.getBoundingClientRect().top < window.innerHeight) return;
    const show = () => { node.dataset.reveal = "visible"; observer.disconnect(); clearTimeout(fallback); };
    const observer = new IntersectionObserver(items => { if (items.some(i => i.isIntersecting)) show(); }, { rootMargin: "0px 0px 30px 0px", threshold: 0.05 });
    node.dataset.reveal = "waiting";
    observer.observe(node);
    // Fail open if an observer/browser stalls; no permanently hidden content.
    const fallback = window.setTimeout(show, 4000);
    const reduce = () => { if (preference.matches) show(); };
    preference.addEventListener("change", reduce);
    return () => { observer.disconnect(); clearTimeout(fallback); preference.removeEventListener("change", reduce); node.dataset.reveal = "visible"; };
  }, []);
  return <div ref={element} className={styles.reveal} style={{ "--reveal-delay": `${Math.min(Math.max(delay, 0), 180)}ms` } as React.CSSProperties}>{children}</div>;
}
