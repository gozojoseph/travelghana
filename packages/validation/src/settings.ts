import { z } from "zod";

/**
 * Site settings (D24) are edited as one form: every field is sent on every
 * save and an empty string clears the field. All fields are optional - the
 * public footer and about page only render what is filled in.
 */

/** Loose phone check: at least 7 chars of digits/spaces, optional + - ( ). */
const phoneChars = /^[+()\-\s\d]{7,40}$/;

const requiredClearable = (max: number) => z.string().trim().max(max);

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .refine(
    (v) => v === "" || z.string().email().safeParse(v).success,
    { message: "Enter a valid email address" },
  );

const optionalSocialUrl = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === "" || /^https?:\/\/\S+$/i.test(v),
    { message: "Must be a valid http(s) URL" },
  );

const clearablePhone = requiredClearable(40).refine(
  (v) => v === "" || phoneChars.test(v),
  { message: "Enter a valid phone number" },
);

export const siteSettingsUpdateSchema = z.object({
  phone: clearablePhone,
  whatsapp: requiredClearable(40).refine(
    (v) => v === "" || phoneChars.test(v),
    { message: "Enter a valid WhatsApp number" },
  ),
  email: optionalEmail,
  address: requiredClearable(300),
  facebookUrl: optionalSocialUrl,
  instagramUrl: optionalSocialUrl,
  twitterUrl: optionalSocialUrl,
  youtubeUrl: optionalSocialUrl,
  // D44: manual payment instructions (Mobile Money + bank transfer). Freeform
  // blocks merged verbatim into booking confirmation emails; empty hides them.
  momoInstructions: requiredClearable(2000),
  bankInstructions: requiredClearable(2000),
});

export type SiteSettingsUpdateInput = z.infer<typeof siteSettingsUpdateSchema>;
