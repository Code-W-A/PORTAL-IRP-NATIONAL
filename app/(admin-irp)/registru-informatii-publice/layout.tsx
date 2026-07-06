"use client";

import ProtectedDbIsu from "@/app/(admin-irp)/components/ProtectedDbIsu";

export default function RegistruInformatiiPubliceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedDbIsu>{children}</ProtectedDbIsu>;
}
