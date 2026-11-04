import { redirect } from "next/navigation";

/** Legacy entry point — the planner now starts with the trip brief. */
export default function PlanPage() {
  redirect("/plan-my-trip");
}
