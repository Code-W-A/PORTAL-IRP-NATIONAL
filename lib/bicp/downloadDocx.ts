import type { BicpDocxVariant } from "./docxVariants";

/** Fetch before downloading so API failures remain visible in the document list. */
export async function downloadBicpDocx(url: string, variant: BicpDocxVariant) {
  const response = await fetch(`${url}&variant=${variant}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Nu s-a putut descărca documentul DOCX.");
  }
  const blob = await response.blob();
  const filename = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/i)?.[1]
    || `document_${variant}.docx`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
