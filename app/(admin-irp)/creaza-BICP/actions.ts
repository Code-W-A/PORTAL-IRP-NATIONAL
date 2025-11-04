"use server";
import { revalidatePath } from "next/cache";

export async function generateDocxFromTemplate(input: { title: string; content: string }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/generate/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Eroare generare DOCX");
  // Not returned to client; this action is example placeholder for future server workflows
  revalidatePath("/lista-BICP");
}


