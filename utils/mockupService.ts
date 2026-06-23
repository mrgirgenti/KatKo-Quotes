// ─────────────────────────────────────────────────────────────────────────────
// Primary Mockup Resolution Service
//
// THE SINGLE AUTHORITATIVE SOURCE for project imagery throughout Katalyst OS.
// Every surface (Client Hub, Org Details, PDFs, Production, Documents) must
// consume the resolved DTO fields — never independently derive images from
// raw line-item arrays.
//
// DTO fields emitted by every project-list and project-detail API:
//   primaryMockup         — canonical hero image (null → render initials avatar)
//   mockupGallery         — all mockups in display order, primary first
//   mockupCount           — total count for carousel indicators
//   resolvedImageSource   — resolution tier, for UI decisions
//
// Resolution order for primaryMockup:
//   1. First line item with a non-empty mockupUri
//   2. null → caller renders initial/avatar fallback
//
// Gallery = all non-empty mockupUri values across line items, primary first.
// ─────────────────────────────────────────────────────────────────────────────

export type MockupSource = 'mockup' | 'fallback';

export interface ResolvedMockups {
  /** Canonical primary image. Null means show initials/avatar fallback. */
  primaryMockup: string | null;
  /** All mockup URIs in display order — primary first. Empty when no mockups. */
  mockupGallery: string[];
  /** Total count. Drives carousel dot indicators. */
  mockupCount: number;
  /** Resolution tier — useful for image sizing decisions (contain vs cover). */
  resolvedImageSource: MockupSource;
}

/**
 * Resolve the authoritative mockup set for a project from its raw line items.
 * Accepts both typed LineItem[] and raw DB any[] (lineItemsData).
 */
export function resolveMockups(lineItems: any[]): ResolvedMockups {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return {
      primaryMockup: null,
      mockupGallery: [],
      mockupCount: 0,
      resolvedImageSource: 'fallback',
    };
  }

  const gallery: string[] = lineItems
    .map((li: any) =>
      typeof li?.mockupUri === 'string' ? li.mockupUri.trim() : ''
    )
    .filter(Boolean);

  const primaryMockup = gallery[0] ?? null;

  return {
    primaryMockup,
    mockupGallery: gallery,
    mockupCount: gallery.length,
    resolvedImageSource: primaryMockup ? 'mockup' : 'fallback',
  };
}
