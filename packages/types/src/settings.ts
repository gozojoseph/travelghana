/**
 * Site settings (D24) - singleton, admin-managed contact + social info shown
 * in the public footer and the about page. All fields are optional; surfaces
 * hide what is not filled in. updatedAt is null until an admin first saves.
 */
export interface SiteSettings {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  /** D44: manual payment instructions merged into confirmation emails. */
  momoInstructions: string | null;
  bankInstructions: string | null;
  updatedAt: string | null;
}
