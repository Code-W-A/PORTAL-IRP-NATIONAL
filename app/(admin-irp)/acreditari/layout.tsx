"use client";

import Protected from "@/app/(admin-irp)/components/Protected";

export default function AcreditariLayout({ children }: { children: React.ReactNode }) {
  return <Protected requireAdmin>{children}</Protected>;
}

