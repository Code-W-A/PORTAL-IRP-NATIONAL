"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";

type ProtectedProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
  redirectTo?: string;
};

export default function Protected({ children, requireAdmin = false, redirectTo = "/lista-BICP" }: ProtectedProps) {
  const router = useRouter();
  const { user, loading, isAdmin } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
    if (!loading && user && requireAdmin && !isAdmin) {
      router.replace(redirectTo);
    }
  }, [loading, user, isAdmin, requireAdmin, redirectTo, router]);

  if (loading) {
    return <div className="p-6">Se încarcă…</div>;
  }
  if (!user) return null;
  if (requireAdmin && !isAdmin) return null;
  return <>{children}</>;
}
