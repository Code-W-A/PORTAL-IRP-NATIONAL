"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import type { GuideAuthor } from "@/lib/ghid-comunicare/types";

export function useGuideApi() {
  const { user } = useAuth();
  return useCallback(async function request<T>(path = "", options: RequestInit = {}): Promise<T> {
    if (!user) throw new Error("Autentifică-te pentru a accesa ghidul.");
    const token = await user.getIdToken();
    const response = await fetch(`/api/ghid-comunicare${path}`, { ...options, cache: "no-store",
      headers: { "Content-Type": "application/json", ...options.headers, Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Nu am putut finaliza operațiunea. Încearcă din nou.");
    return data as T;
  }, [user]);
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "A apărut o eroare. Încearcă din nou.";
}
export function ErrorNotice({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{children}</p>;
}
export function guideUrl(query: string, suffix = "") {
  return `/ghid-comunicare${suffix}${query ? `?q=${encodeURIComponent(query)}` : ""}`;
}
export function BackLink({ href }: { href: string }) {
  return <Button asChild variant="ghost" size="lg" className="self-start px-0"><Link href={href} scroll={href.split("?")[0] !== "/ghid-comunicare"}>← Înapoi</Link></Button>;
}
export function AuthorLine({ author, date, proposed = false }: { author: GuideAuthor; date: string; proposed?: boolean }) {
  const formatted = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bucharest" }).format(new Date(date));
  return <p className="break-words text-sm text-gray-500">{proposed ? "Model propus de " : ""}{author.name} · <time dateTime={date}>{formatted}</time></p>;
}
export function CopyAnswer({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch { setStatus("failed"); }
  }
  return <div className="space-y-2">
    <Button type="button" size="lg" onClick={copy}>Copiază răspunsul</Button>
    <p role="status" className={`text-sm ${status === "failed" ? "text-red-700" : "text-green-700"}`}>
      {status === "copied" ? "Răspuns copiat" : status === "failed" ? "Nu am putut copia răspunsul. Selectează textul și folosește opțiunea de copiere a dispozitivului." : ""}
    </p>
  </div>;
}
export const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";
