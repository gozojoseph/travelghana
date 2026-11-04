/**
 * Ghana national flag as inline vector art: 2:3 ratio, red / gold / green bands
 * with the Black Star centred on the gold band.
 *
 * The flag uses its own fixed official colours by definition (red #CE1126,
 * gold #FCD116, green #006B3F) - an intentional, documented exception to the
 * "consume design tokens" rule, since a national flag cannot be re-themed.
 * The brand palette merely echoes it (--tg-primary / --tg-accent match the
 * flag green/red).
 *
 * Decorative by policy: always rendered aria-hidden. The caller must provide
 * the word "Ghana" (or country context) as adjacent text.
 */
export function GhanaFlag({ className = "h-4 w-auto" }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 3 2" className={className}>
      <rect width="3" height={2 / 3} fill="#CE1126" />
      <rect y={2 / 3} width="3" height={2 / 3} fill="#FCD116" />
      <rect y={4 / 3} width="3" height={2 / 3} fill="#006B3F" />
      {/* Black Star of Ghana, inscribed circle ~= 0.55 of the band height. */}
      <polygon
        points="1.5,0.81 1.543,0.941 1.681,0.941 1.569,1.022 1.612,1.154 1.5,1.073 1.388,1.154 1.431,1.022 1.319,0.941 1.457,0.941"
        fill="#000000"
      />
    </svg>
  );
}
