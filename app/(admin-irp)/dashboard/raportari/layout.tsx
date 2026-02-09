"use client";

import Protected from "@/app/(admin-irp)/components/Protected";

export default function RaportariLayout({ children }: { children: React.ReactNode }) {
  return <Protected requireAdmin redirectTo="/403">{children}</Protected>;
}

