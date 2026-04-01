// src/app/dashboard/page.tsx
// Redirects /dashboard to /dashboard/system-health
import { redirect } from "next/navigation";
export default function DashboardIndex() {
  redirect("/dashboard/system-health");
}