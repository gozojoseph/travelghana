import { MessageCircle } from "lucide-react";

import { fetchSiteSettings, waMeHref } from "@/lib/site-settings";

/**
 * Floating WhatsApp chat button (D40). Rendered from the site settings
 * singleton: when no number is configured it renders nothing, so the
 * affordance exists exactly when the team wants it, toggleable from the
 * admin settings page.
 */
export async function WhatsAppFab() {
  const settings = await fetchSiteSettings();
  if (!settings?.whatsapp) return null;
  return (
    <a
      href={waMeHref(settings.whatsapp)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with TravelGhana on WhatsApp"
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
    >
      <MessageCircle aria-hidden className="h-6 w-6" />
    </a>
  );
}
