"use client";

import { Suspense } from "react";

import JarvisClient from "./JarvisClient";

export default function JarvisPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] bg-[#020308] p-6 text-sm text-sky-200/70">Se inițializează JARVIS…</div>}>
      <JarvisClient />
    </Suspense>
  );
}
