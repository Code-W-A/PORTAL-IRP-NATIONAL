"use client";
import { FirebaseError } from "firebase/app";
import { initFirebase } from "@/lib/firebase";
import { GuideService } from "@/lib/ghid-comunicare/service";
import { GuideError } from "@/lib/ghid-comunicare/validation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import type { GuideAuthor } from "@/lib/ghid-comunicare/types";

export function useGuide() {
  const { user } = useAuth();
  return useMemo(() => user ? new GuideService(initFirebase().db, user) : null, [user]);
}
export function errorMessage(error: unknown) {
  if (error instanceof GuideError) return error.message;
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return "Contul nu are acces la această operațiune în ghid.";
  }
  return "Nu am putut finaliza operațiunea. Încearcă din nou.";
}
export function ErrorNotice({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{children}</p>;
}
export type GuideLocation = { query: string; category: string; favorites: boolean; selected?: string; prefill?: boolean };

export function guideLocation(params: { get: (key: string) => string | null }): GuideLocation {
  return {
    query: params.get("q") || "",
    category: params.get("categorie") || "",
    favorites: params.get("favorite") === "1",
    selected: params.get("situatie") || undefined,
    prefill: params.get("prefill") === "1",
  };
}

export function guideUrl(location: GuideLocation, suffix = "") {
  const params = new URLSearchParams();
  if (location.query) params.set("q", location.query);
  if (location.category) params.set("categorie", location.category);
  if (location.favorites) params.set("favorite", "1");
  if (location.selected) params.set("situatie", location.selected);
  if (location.prefill) params.set("prefill", "1");
  const search = params.toString();
  return `/ghid-comunicare${suffix}${search ? `?${search}` : ""}`;
}
export function BackLink({ href }: { href: string }) {
  return <Button asChild variant="ghost" size="lg" className="self-start px-0"><Link href={href} scroll={href.split("?")[0] !== "/ghid-comunicare"}>← Înapoi</Link></Button>;
}
export function AuthorLine({ author, date, proposed = false }: { author: GuideAuthor; date: string; proposed?: boolean }) {
  const value = new Date(date);
  const formatted = Number.isNaN(value.getTime()) ? null : new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bucharest",
  }).format(value);
  return <p className="break-words text-sm text-gray-500">{proposed ? "Model propus de " : ""}{author.name}
    {formatted ? <> · <time dateTime={date}>{formatted}</time></> : null}
  </p>;
}
export function CopyAnswer({ text, compact = false }: { text: string; compact?: boolean }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);

  async function copy() {
    clearTimeout(timeout.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      timeout.current = setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("failed");
    }
  }

  return <div>
    <Button type="button" size={compact ? "sm" : "lg"} variant={compact ? "outline" : "default"}
      className="min-h-10" onClick={copy}>{status === "copied" ? "Copiat" : "Copiază răspunsul"}</Button>
    <span role="status" className={status === "failed" ? "mt-1 block text-sm text-red-700" : "sr-only"}>
      {status === "copied" ? "Răspuns copiat" : status === "failed" ? "Nu am putut copia răspunsul. Selectează textul și folosește opțiunea de copiere a dispozitivului." : ""}
    </span>
  </div>;
}
export const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";
