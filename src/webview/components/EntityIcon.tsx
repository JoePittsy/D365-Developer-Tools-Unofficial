import { GENERIC_ENTITY_ICON } from '../helpers';

// Renders a table's icon: the decoded real SVG once loaded, otherwise the generic glyph.
// Fetching/caching/dedupe is handled by useIcon (TanStack Query); virtualization means only
// visible rows mount, so there's no need for the old in-view IntersectionObserver gating.
export function EntityIcon({ svg }: { svg?: string }) {
  const hasReal = !!svg;
  return (
    <span
      className={'entity-icon-slot' + (hasReal ? ' real-icon' : '')}
      dangerouslySetInnerHTML={{ __html: svg ?? GENERIC_ENTITY_ICON }}
    />
  );
}
