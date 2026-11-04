/**
 * JSON-LD renderer (D40 SEO). Schema.org structured data is emitted as
 * inline script tags on public pages; the payloads are built server-side
 * from the same data the page renders (no invented facts).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
