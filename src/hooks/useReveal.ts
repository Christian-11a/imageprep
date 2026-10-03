import { useEffect, type RefObject } from 'react';

/** Reveals marked descendants as they enter view; CSS keeps content visible until JS is ready. */
export function useReveal(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    container.dataset.revealReady = 'true';
    const targets = [
      ...(container.matches('[data-reveal]') ? [container] : []),
      ...container.querySelectorAll<HTMLElement>('[data-reveal]'),
    ];
    const showAll = () => targets.forEach(target => { target.dataset.visible = 'true'; });
    if (targets.length === 0) return () => { delete container.dataset.revealReady; };

    const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    let observer: IntersectionObserver | null = null;
    const onMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        showAll();
        observer?.disconnect();
      }
    };
    motionQuery?.addEventListener?.('change', onMotionChange);
    // Older Safari versions expose addListener instead of addEventListener.
    if (motionQuery && !motionQuery.addEventListener) motionQuery.addListener(onMotionChange);
    const cleanup = () => {
      observer?.disconnect();
      motionQuery?.removeEventListener?.('change', onMotionChange);
      if (motionQuery && !motionQuery.removeEventListener) motionQuery.removeListener(onMotionChange);
      delete container.dataset.revealReady;
    };

    if (motionQuery?.matches || typeof IntersectionObserver === 'undefined') {
      showAll();
      return cleanup;
    }

    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.visible = 'true';
          revealObserver.unobserve(entry.target);
        }
      }
    }, { threshold: 0, rootMargin: '0px 0px -36px 0px' });
    observer = revealObserver;

    for (const target of targets) {
      if (target.dataset.visible === 'true') continue;
      const bounds = target.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < window.innerHeight) {
        target.dataset.visible = 'true';
        continue;
      }
      revealObserver.observe(target);
    }
    return cleanup;
  }, [ref]);
}
