"use client";

import ProtectedDbIsu from "@/app/(admin-irp)/components/ProtectedDbIsu";

export default function StatisticiInterventiiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedDbIsu>{children}</ProtectedDbIsu>;
}
