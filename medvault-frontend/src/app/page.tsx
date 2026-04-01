import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function parseRole(token: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export default async function RootPage() {
  const token = (await cookies()).get("medvault_token")?.value;

  if (token) {
    const role = parseRole(token);
    if (role === "patient") redirect("/patient");
    if (role) redirect("/dashboard");
  }

  // No token → show landing
  redirect("/landing");
}