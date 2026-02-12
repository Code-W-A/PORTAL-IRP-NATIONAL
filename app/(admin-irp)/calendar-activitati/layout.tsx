"use client";

import Protected from "@/app/(admin-irp)/components/Protected";

export default function CalendarActivitatiLayout({ children }: { children: React.ReactNode }) {
  return <Protected requireAdmin redirectTo="/lista-BICP?accessDenied=1">{children}</Protected>;
}
