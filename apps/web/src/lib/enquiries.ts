import type { Enquiry } from "@travelghana/types";
import type { EnquiryCreateInput } from "@travelghana/validation";

import { apiRequest } from "@/lib/api";

/**
 * Trip enquiry capture (D6). Public capture works with or without a session;
 * the API attaches the signed-in author automatically when present.
 */
export function createEnquiry(
  input: EnquiryCreateInput,
): Promise<{ enquiry: Enquiry }> {
  return apiRequest<{ enquiry: Enquiry }>("/enquiries", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
