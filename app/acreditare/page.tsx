"use client";

import { CerereAcreditareForm } from "./components/CerereAcreditareForm";

export default function PublicAcreditarePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <CerereAcreditareForm mode="public" />
      </div>
    </div>
  );
}


