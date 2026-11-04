import type { MailMessage } from "./mailer";

/**
 * All transactional email templates. The recipient is attached by the caller;
 * templates fill subject/body only (EmailTemplate). HTML is table-based with
 * inline styles only: email clients strip <style> blocks and modern CSS.
 * Palette matches the web theme (Ghana Green #006b3f, sparing accents).
 *
 * D35: lifecycle emails (verification, password reset) lead with a 6-digit
 * code and keep the deep link as a fallback. D36: booking events (receipt,
 * acknowledgement, approval, concern, cancellation), trip-plan
 * acknowledgements, and the admin copy of new booking requests reuse the same
 * layout with reference codes and message blocks instead of OTP codes.
 */
export type EmailTemplate = Omit<MailMessage, "to">;

const GREEN = "#006b3f";
const INK = "#17211b";
const MUTED = "#65736b";
const SURFACE = "#f4f6f5";
const HAIRLINE = "#e6ebe8";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function greet(name?: string | null): string {
  return name ? `Hi ${name},` : "Hi there,";
}

/** User-provided text quoted back inside a message/reason block. */
function quoteNote(body: string): string {
  return `"${body.trim()}"`;
}

interface MetaRow {
  label: string;
  value: string;
}

function rowsHtml(rows: MetaRow[]): string {
  if (rows.length === 0) return "";
  const cells = rows
    .map(
      (row) =>
        `<tr><td style="padding:8px 0;border-top:1px solid ${HAIRLINE};font-size:13px;color:${MUTED};width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>` +
        `<td style="padding:8px 0;border-top:1px solid ${HAIRLINE};font-size:14px;color:${INK};font-weight:600;">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 6px;border-collapse:collapse;">${cells}</table>`;
}

function noteHtml(label: string, body: string): string {
  return `<div style="margin:18px 0;padding:14px 16px;background:${SURFACE};border-left:3px solid ${GREEN};border-radius:0 8px 8px 0;">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:0.5px;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:${INK};white-space:pre-line;">${escapeHtml(quoteNote(body))}</p>
</div>`;
}

/** Verbatim instruction block (D44): settings text, never quoted or altered. */
function sectionHtml(label: string, body: string): string {
  return `<div style="margin:18px 0;padding:14px 16px;background:${SURFACE};border-left:3px solid ${GREEN};border-radius:0 8px 8px 0;">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:0.5px;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:${INK};white-space:pre-line;">${escapeHtml(body)}</p>
</div>`;
}

function actionHtml(url: string, label: string): string {
  const safeUrl = escapeHtml(url);
  return `<p style="margin:0 0 18px;"><a href="${safeUrl}" style="display:inline-block;background:${GREEN};color:#ffffff;padding:12px 28px;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">If the button doesn't work, copy this link into your browser:<br /><span style="color:${INK};word-break:break-all;">${safeUrl}</span></p>`;
}

interface LayoutInput {
  preheader: string;
  heading: string;
  intro: string;
  /** Optional reference/OTP code shown as a signpost chip. */
  code?: string;
  /** "otp" = 6 digits, large tracking; "reference" = chunky short code. */
  codeStyle?: "otp" | "reference";
  rows?: MetaRow[];
  note?: { label: string; body: string };
  /** Verbatim pre-formatted blocks (e.g. payment instructions) - NOT quoted back. */
  sections?: { label: string; body: string }[];
  action?: { label: string; url: string };
  expiryNote?: string;
  footnote: string;
}

function layout(input: LayoutInput): string {
  const { preheader, heading, intro, code, codeStyle, rows, note, sections, action, expiryNote, footnote } =
    input;
  const codeChip = code
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background:${SURFACE};border-radius:8px;padding:18px;text-align:center;">
<span style="font-size:${codeStyle === "reference" ? 26 : 34}px;font-weight:700;letter-spacing:${codeStyle === "reference" ? 4 : 8}px;color:${GREEN};">${escapeHtml(code)}</span>
</td></tr></table>`
    : "";
  const followUp = expiryNote
    ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:${MUTED};">${expiryNote}</p>`
    : "";
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:${SURFACE};">
    <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="background:${GREEN};padding:22px 32px;border-radius:12px 12px 0 0;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">TravelGhana</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${escapeHtml(heading)}</h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:${MUTED};">${intro}</p>
                ${codeChip}
                ${rowsHtml(rows ?? [])}
                ${(sections ?? []).map((section) => sectionHtml(section.label, section.body)).join("")}
                ${note ? noteHtml(note.label, note.body) : ""}
                ${action ? actionHtml(action.url, action.label) : ""}
                ${followUp}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 22px;border-top:1px solid ${HAIRLINE};">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">${footnote}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/* ─── Auth lifecycle (D35) ─────────────────────────────────────────────────── */

export interface LifecycleEmailInput {
  name?: string | null;
  /** 6-digit code, shown prominently in the body. */
  code: string;
  /** Absolute fallback URL that performs the same action. */
  url: string;
}

/** "Verify your TravelGhana email" - code first, link as the fallback. */
export function verificationEmail(input: LifecycleEmailInput): EmailTemplate {
  const preheader = `Your TravelGhana verification code is ${input.code}. It expires in 1 hour.`;
  const intro = `${escapeHtml(greet(input.name))} use this code to verify your email:`;
  return {
    subject: "Verify your TravelGhana email",
    text: [
      greet(input.name),
      "",
      `Your TravelGhana verification code is: ${input.code}`,
      "",
      "Or verify by opening this link:",
      input.url,
      "",
      "The code and link expire in 1 hour.",
      "If you didn't create a TravelGhana account, you can safely ignore this email.",
    ].join("\n"),
    html: layout({
      preheader: escapeHtml(preheader),
      heading: "Verify your email",
      intro,
      code: input.code,
      codeStyle: "otp",
      action: { label: "Verify my email", url: input.url },
      expiryNote: "The code and link expire in 1 hour.",
      footnote:
        "You're receiving this because someone (hopefully you) signed up for TravelGhana with this email address.",
    }),
  };
}

/** "Reset your TravelGhana password" - code first, link as the fallback. */
export function resetEmail(input: LifecycleEmailInput): EmailTemplate {
  const preheader = `Your TravelGhana password reset code is ${input.code}. It expires in 1 hour.`;
  const intro = `${escapeHtml(greet(input.name))} use this code to choose a new password:`;
  return {
    subject: "Reset your TravelGhana password",
    text: [
      greet(input.name),
      "",
      `Your TravelGhana password reset code is: ${input.code}`,
      "",
      "Or set a new password by opening this link:",
      input.url,
      "",
      "The code and link expire in 1 hour.",
      "If you didn't request this, you can ignore this email and your password stays as it was.",
    ].join("\n"),
    html: layout({
      preheader: escapeHtml(preheader),
      heading: "Reset your password",
      intro,
      code: input.code,
      codeStyle: "otp",
      action: { label: "Choose a new password", url: input.url },
      expiryNote: "The code and link expire in 1 hour.",
      footnote:
        "You're receiving this because a password reset was requested for this email on TravelGhana. If it wasn't you, ignore this email and your password stays as it was.",
    }),
  };
}

/* ─── Booking events (D36) ─────────────────────────────────────────────────── */

export type BookingEmailKind =
  | "received"
  | "acknowledged"
  | "confirmed"
  | "paid"
  | "concern"
  | "cancelled";

export interface BookingEventEmailInput {
  kind: BookingEmailKind;
  name?: string | null;
  code: string;
  packageTitle: string;
  startLabel: string;
  party: string;
  /** Admin-written note / concern / cancellation reason, quoted back. */
  adminMessage?: string | null;
  /**
   * Manual payment instructions (D44), taken verbatim from the admin settings
   * when the team filled them in. Only attached to confirmations - the email
   * copy itself never adds amounts or prices of any kind.
   */
  payment?: { momo?: string | null; bank?: string | null } | null;
  url?: string;
}

interface BookingCopy {
  subject: (code: string) => string;
  heading: string;
  intro: string;
  actionLabel: string;
  footnote: string;
}

const BOOKING_COPY: Record<BookingEmailKind, BookingCopy> = {
  received: {
    subject: (code) => `We received your TravelGhana booking request (${code})`,
    heading: "Booking request received",
    intro: "Thanks for booking with us - here's your reference and the details we have.",
    actionLabel: "Review my booking requests",
    footnote:
      "You're receiving this because you placed a booking request on TravelGhana. Nothing is charged unless the booking explicitly states otherwise.",
  },
  acknowledged: {
    subject: (code) => `We're looking after your TravelGhana booking (${code})`,
    heading: "Booking acknowledged",
    intro: "Someone on our team has picked up your booking request and is looking after it.",
    actionLabel: "Review my booking requests",
    footnote:
      "You're receiving this because the TravelGhana team acted on your booking request.",
  },
  confirmed: {
    subject: (code) => `Your TravelGhana booking (${code}) is confirmed`,
    heading: "Booking confirmed",
    intro:
      "Good news - our team has confirmed your booking. How to pay is set out below when the team has filled in the payment details.",
    actionLabel: "Review my booking requests",
    footnote: "You're receiving this because the TravelGhana team confirmed your booking request.",
  },
  paid: {
    subject: (code) => `Payment received for your TravelGhana booking (${code})`,
    heading: "Payment received",
    intro: "Our team has recorded your payment for this booking - you are all set.",
    actionLabel: "Review my booking requests",
    footnote:
      "You're receiving this because the TravelGhana team marked your booking as paid. We never send or ask for card details by email.",
  },
  concern: {
    subject: (code) => `A note from our team about your TravelGhana booking (${code})`,
    heading: "A note about your booking",
    intro: "Our team has left you a note about your booking:",
    actionLabel: "Review my booking requests",
    footnote:
      "You're receiving this because the TravelGhana team has a question or a detail about your booking.",
  },
  cancelled: {
    subject: (code) => `Your TravelGhana booking (${code}) was cancelled`,
    heading: "Booking cancelled",
    intro: "With regret - your booking request has been cancelled. The details are below.",
    actionLabel: "Review my booking requests",
    footnote:
      "You're receiving this because the TravelGhana team cancelled this booking request. You can place a new request any time.",
  },
};

/** Verbatim payment instructions (D44): booking code as reference, no amounts. */
function paymentSection(
  payment: BookingEventEmailInput["payment"],
  code: string,
): { label: string; body: string } | null {
  const momo = (payment?.momo ?? "").trim();
  const bank = (payment?.bank ?? "").trim();
  if (!momo && !bank) return null;
  let body = `Use your booking reference ${code} as the payment reference whenever you pay.`;
  if (momo) body += `\n\nMOBILE MONEY\n${momo}`;
  if (bank) body += `\n\nBANK TRANSFER\n${bank}`;
  return { label: "How to pay", body };
}

/** Booking lifecycle email (D36/D44) - receipt, acknowledgement, decisions. */
export function bookingEventEmail(input: BookingEventEmailInput): EmailTemplate {
  const copy = BOOKING_COPY[input.kind];
  const kind = input.kind;
  const detail: MetaRow[] = [
    { label: "Package", value: input.packageTitle },
    { label: "Start date", value: input.startLabel },
    { label: "Party", value: input.party },
  ];
  const paySection = kind === "confirmed" ? paymentSection(input.payment, input.code) : null;
  const sections = paySection ? [paySection] : [];
  const confirmedIntro = paySection
    ? "Good news - our team has confirmed your booking. How to pay is set out below; nothing is charged automatically."
    : "Good news - our team has confirmed your booking. Nothing has been charged yet; we'll follow up with payment details.";

  const noteBlock =
    kind === "received"
      ? input.adminMessage
        ? ({ label: "Your note", body: input.adminMessage } as const)
        : undefined
      : input.adminMessage
        ? ({
            label:
              kind === "concern"
                ? "A note from our team"
                : kind === "cancelled"
                  ? "Cancellation reason"
                  : "A message from our team",
            body: input.adminMessage,
          } as const)
        : undefined;

  const html = layout({
    preheader: `${input.packageTitle} - booking ${input.code}`,
    heading: copy.heading,
    intro: `${escapeHtml(greet(input.name))} ${escapeHtml(kind === "confirmed" ? confirmedIntro : copy.intro)}`,
    code: input.code,
    codeStyle: "reference",
    rows: detail,
    sections,
    note: noteBlock,
    action: input.url ? { label: copy.actionLabel, url: input.url } : undefined,
    footnote: copy.footnote,
  });

  // Plain-text twin: the same content, blank lines as section separators.
  const lines: string[] = [greet(input.name), ""];
  if (kind === "received") {
    pushDetail(lines, detail);
    lines.push(
      "",
      "Nothing is charged yet - no payment has been taken. Our team will",
      "confirm availability and follow up with next steps.",
    );
    if (input.adminMessage) lines.push("", `Your note: ${input.adminMessage}`);
    if (input.url) lines.push("", `Review your booking requests: ${input.url}`);
  } else if (kind === "acknowledged") {
    lines.push(`An acknowledgement for your booking request ${input.code}:`);
    pushDetail(lines, detail);
    if (input.adminMessage) lines.push("", `A message from our team: "${input.adminMessage}"`);
    lines.push("", "You don't need to do anything - we'll follow up as needed.");
  } else if (kind === "confirmed") {
    lines.push(`Our team has confirmed your booking ${input.code}:`);
    pushDetail(lines, detail);
    lines.push("", "Nothing has been charged yet - no payment has been taken.");
    if (paySection) lines.push("", paySection.body);
  } else if (kind === "paid") {
    lines.push(`Our team has recorded your payment for booking ${input.code}:`);
    pushDetail(lines, detail);
    lines.push("", "You are all set. We never send or ask for card details by email.");
  } else if (kind === "concern") {
    lines.push("Our team left you the note below about your booking:");
    pushDetail(lines, detail);
    if (input.adminMessage) lines.push("", `"${input.adminMessage}"`);
  } else {
    lines.push(`Your booking request ${input.code} was cancelled:`);
    pushDetail(lines, detail);
    if (input.adminMessage) lines.push("", `Cancellation reason: "${input.adminMessage}"`);
    lines.push("", "You can place a new request any time.");
  }
  lines.push("", "- The TravelGhana team");

  return { subject: copy.subject(input.code), text: lines.join("\n"), html };
}

function pushDetail(lines: string[], rows: MetaRow[]): void {
  for (const row of rows) lines.push(`${row.label}: ${row.value}`);
}

/** Admin copy: tells the owner's mailbox about every new booking request. */
export function bookingAdminNoticeEmail(input: {
  code: string;
  packageTitle: string;
  startLabel: string;
  party: string;
  traveler: string;
  notes?: string | null;
  url: string;
}): EmailTemplate {
  return {
    subject: `New booking request ${input.code} - ${input.packageTitle}`,
    text: [
      "New booking request on TravelGhana:",
      "",
      `Reference: ${input.code}`,
      `Package: ${input.packageTitle}`,
      `Start date: ${input.startLabel}`,
      `Party: ${input.party}`,
      `Traveler: ${input.traveler}${input.notes ? `\nNotes: ${input.notes}` : ""}`,
      "",
      `Review it in the bookings queue: ${input.url}`,
    ].join("\n"),
    html: layout({
      preheader: `New booking request ${input.code} from ${input.traveler}`,
      heading: "New booking request",
      intro: "A traveler just placed the request below:",
      code: input.code,
      codeStyle: "reference",
      rows: [
        { label: "Package", value: input.packageTitle },
        { label: "Start date", value: input.startLabel },
        { label: "Party", value: input.party },
        { label: "Traveler", value: input.traveler },
        ...(input.notes ? [{ label: "Notes", value: input.notes }] : []),
      ],
      action: { label: "Open the bookings queue", url: input.url },
      footnote: "Automated notice - the API emails this address for every new booking request.",
    }),
  };
}

/* ─── Trip plans (D36) ─────────────────────────────────────────────────────── */

export interface TripPlanEmailInput {
  name?: string | null;
  tripName: string;
  datesLabel: string;
  party: string;
  url: string;
}

/** Sent when a traveler saves a new trip plan. */
export function tripPlanEmail(input: TripPlanEmailInput): EmailTemplate {
  const title = input.tripName.length > 40 ? `${input.tripName.slice(0, 39)}...` : input.tripName;
  return {
    subject: `Your TravelGhana trip plan "${title}" is saved`,
    text: [
      greet(input.name),
      "",
      `Your trip plan "${input.tripName}" is saved.`,
      input.datesLabel,
      `Party: ${input.party}`,
      "",
      "It's a private draft - nothing is booked yet. You can keep planning any time:",
      input.url,
      "",
      "- The TravelGhana team",
    ].join("\n"),
    html: layout({
      preheader: `Your trip plan "${title}" is saved on TravelGhana.`,
      heading: "Your trip plan is saved",
      intro: `${escapeHtml(greet(input.name))} your plan is safely stored as a private draft - nothing is booked or charged yet.`,
      rows: [
        { label: "Trip", value: input.tripName },
        { label: "Dates", value: input.datesLabel },
        { label: "Party", value: input.party },
      ],
      action: { label: "Open my trip plan", url: input.url },
      footnote:
        "You're receiving this because you created a trip plan on TravelGhana. It stays a draft until you book.",
    }),
  };
}

/* ─── Transport listing requests (D43) ─────────────────────────────────────── */

export type ListingRequestEmailKind =
  | "received"
  | "quote"
  | "confirmed"
  | "cancelled";

export interface ListingRequestEmailInput {
  kind: ListingRequestEmailKind;
  name?: string | null;
  code: string;
  listingTitle: string;
  providerName: string;
  serviceArea?: string | null;
  dateLabel: string;
  party: string;
  /** The team's quote / decision message, quoted back. */
  teamMessage?: string | null;
  url?: string;
}

const REQUEST_COPY: Record<ListingRequestEmailKind, { subject: (code: string) => string; heading: string; intro: string; actionLabel: string; footnote: string }> = {
  received: {
    subject: (code) => `We received your TravelGhana transport request (${code})`,
    heading: "Transport request received",
    intro: "Thanks for asking about this service - here is your reference and the details we have. Our team will reply with a quote.",
    actionLabel: "Review my transport requests",
    footnote:
      "You're receiving this because you requested a quote for a transport service on TravelGhana. Nothing is booked or charged yet.",
  },
  quote: {
    subject: (code) => `A quote from our team about your TravelGhana transport request (${code})`,
    heading: "Your quote is here",
    intro: "The team has replied to your transport request with a quote:",
    actionLabel: "Review my transport requests",
    footnote:
      "You're receiving this because the TravelGhana team sent a quote for your transport request.",
  },
  confirmed: {
    subject: (code) => `Your TravelGhana transport request (${code}) is confirmed`,
    heading: "Transport request confirmed",
    intro: "Good news - the team has confirmed your transport request. Any payment is arranged directly with the team as set out in your quote.",
    actionLabel: "Review my transport requests",
    footnote:
      "You're receiving this because the TravelGhana team confirmed your transport request.",
  },
  cancelled: {
    subject: (code) => `Your TravelGhana transport request (${code}) was cancelled`,
    heading: "Transport request cancelled",
    intro: "With regret - your transport request has been cancelled. The details are below.",
    actionLabel: "Review transport options",
    footnote:
      "You're receiving this because the TravelGhana team cancelled this transport request. You can place a new request any time.",
  },
};

const REQUEST_NOTE_LABEL: Record<ListingRequestEmailKind, string | null> = {
  received: "Your note",
  quote: "Your quote",
  confirmed: "A message from our team",
  cancelled: "Cancellation reason",
};

/** Transport request lifecycle email (D43) - receipt, quote reply, decisions. */
export function listingRequestEmail(input: ListingRequestEmailInput): EmailTemplate {
  const copy = REQUEST_COPY[input.kind];
  const detail: MetaRow[] = [
    { label: "Service", value: input.listingTitle },
    { label: "Team", value: input.providerName },
    ...(input.serviceArea ? [{ label: "Service area", value: input.serviceArea } as MetaRow] : []),
    { label: "Travel date", value: input.dateLabel },
    { label: "Party", value: input.party },
  ];
  const noteBlock =
    input.teamMessage && REQUEST_NOTE_LABEL[input.kind]
      ? ({ label: REQUEST_NOTE_LABEL[input.kind] as string, body: input.teamMessage } as const)
      : undefined;

  const html = layout({
    preheader: `${input.listingTitle} - transport request ${input.code}`,
    heading: copy.heading,
    intro: `${escapeHtml(greet(input.name))} ${escapeHtml(copy.intro)}`,
    code: input.code,
    codeStyle: "reference",
    rows: detail,
    note: noteBlock,
    action: input.url ? { label: copy.actionLabel, url: input.url } : undefined,
    footnote: copy.footnote,
  });

  const lines: string[] = [greet(input.name), ""];
  lines.push(`${copy.heading} - reference ${input.code}:`);
  pushDetail(lines, detail);
  if (input.teamMessage) lines.push("", `${REQUEST_NOTE_LABEL[input.kind]}: "${input.teamMessage}"`);
  if (input.kind === "received") {
    lines.push("", "Nothing is booked yet - the team will reply with a quote.");
  }
  if (input.kind === "cancelled") {
    lines.push("", "You can place a new request any time.");
  }
  if (input.url) lines.push("", `${copy.actionLabel}: ${input.url}`);
  lines.push("", "- The TravelGhana team");

  return { subject: copy.subject(input.code), text: lines.join("\n"), html };
}

/** Admin copy: tells the owner's mailbox about every new transport request. */
export function listingRequestAdminNoticeEmail(input: {
  code: string;
  listingTitle: string;
  providerName: string;
  dateLabel: string;
  party: string;
  traveler: string;
  notes?: string | null;
  url: string;
}): EmailTemplate {
  return {
    subject: `New transport request ${input.code} - ${input.listingTitle}`,
    text: [
      "New transport request on TravelGhana:",
      "",
      `Reference: ${input.code}`,
      `Service: ${input.listingTitle}`,
      `Team: ${input.providerName}`,
      `Travel date: ${input.dateLabel}`,
      `Party: ${input.party}`,
      `Traveler: ${input.traveler}${input.notes ? `\nNotes: ${input.notes}` : ""}`,
      "",
      `Review it in the transport requests queue: ${input.url}`,
    ].join("\n"),
    html: layout({
      preheader: `New transport request ${input.code} from ${input.traveler}`,
      heading: "New transport request",
      intro: "A traveler just requested a quote for the service below:",
      code: input.code,
      codeStyle: "reference",
      rows: [
        { label: "Service", value: input.listingTitle },
        { label: "Team", value: input.providerName },
        { label: "Travel date", value: input.dateLabel },
        { label: "Party", value: input.party },
        { label: "Traveler", value: input.traveler },
        ...(input.notes ? [{ label: "Notes", value: input.notes }] : []),
      ],
      action: { label: "Open the transport requests queue", url: input.url },
      footnote: "Automated notice - the API emails this address for every new transport request.",
    }),
  };
}
