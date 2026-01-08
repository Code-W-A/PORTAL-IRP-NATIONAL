"use server";
import { revalidatePath } from "next/cache";

export async function generateDocxFromTemplate(input: { title: string; content: string }) {
  // Avoid calling localhost in production (Vercel). Prefer explicit base URL, then VERCEL_URL, then localhost for dev.
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const res = await fetch(`${baseUrl}/api/generate/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Eroare generare DOCX");
  // Not returned to client; this action is example placeholder for future server workflows
  revalidatePath("/lista-BICP");
}


