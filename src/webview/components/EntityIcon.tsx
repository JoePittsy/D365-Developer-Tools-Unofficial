import { useEffect, useRef } from 'react';
import { GENERIC_ENTITY_ICON } from '../helpers';

// One shared observer for every icon slot, mirroring the original webview's single-observer
// design: icons are only requested once their row scrolls within 120px of the viewport, so a
// large table list doesn't fire a request per row up front.
const callbacks = new WeakMap<Element, () => void>();
const observer =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        entries => {
          for (const en of entries) {
            if (!en.isIntersecting) { continue; }
            observer!.unobserve(en.target);
            callbacks.get(en.target)?.();
            callbacks.delete(en.target);
          }
        },
        { rootMargin: '120px' },
      )
    : null;

interface Props {
  iconKey: string | null;
  /** decoded SVG markup if the real icon has loaded, else undefined */
  svg?: string;
  requestIcon: (key: string) => void;
}

export function EntityIcon({ iconKey, svg, requestIcon }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const hasReal = !!svg;

  useEffect(() => {
    if (!iconKey || hasReal) { return; }
    const el = ref.current;
    if (!el) { return; }
    const request = () => requestIcon(iconKey);
    if (!observer) { request(); return; }
    callbacks.set(el, request);
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      callbacks.delete(el);
    };
  }, [iconKey, hasReal, requestIcon]);

  return (
    <span
      ref={ref}
      className={'entity-icon-slot' + (hasReal ? ' real-icon' : '')}
      dangerouslySetInnerHTML={{ __html: svg ?? GENERIC_ENTITY_ICON }}
    />
  );
}
