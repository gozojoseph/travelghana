import { redirect } from "next/navigation";

/** The full trip brief now lives on /plan-my-trip. */
export default function NewTripPage() {
  redirect("/plan-my-trip");
}
