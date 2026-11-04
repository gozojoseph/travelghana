/* eslint-disable @next/next/no-img-element */
type LogoProps = {
  /** Tailwind sizing (height classes); width stays intrinsic via `w-auto`. */
  className?: string;
  /** Overridable so a visible wordmark next to the mark can make it decorative. */
  alt?: string;
};

/**
 * The Travel Ghana brand mark.
 *
 * Single source of truth is the supplied asset in
 * `public/Travel Ghana Logo.png` (1394x1128, transparent background) - it is
 * referenced by URL, never copied, and must not be modified. The intrinsic
 * `width`/`height` attributes plus `w-auto` keep the original aspect ratio
 * whatever height the caller sets, so the mark can never be stretched.
 */
export function Logo({ className = "", alt = "Travel Ghana logo" }: LogoProps) {
  return (
    <img
      src="/Travel%20Ghana%20Logo.png"
      alt={alt}
      width={1394}
      height={1128}
      decoding="async"
      className={`block w-auto object-contain ${className}`}
    />
  );
}
