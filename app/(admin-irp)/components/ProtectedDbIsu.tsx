"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { canAccessDbIsuFeature } from "@/lib/access/canAccessDbIsuFeature";
import { getTenantContext } from "@/lib/tenant";

type ProtectedDbIsuProps = {
  children: React.ReactNode;
  redirectTo?: string;
};

export default function ProtectedDbIsu({
  children,
  redirectTo = "/lista-BICP?accessDenied=registru",
}: ProtectedDbIsuProps) {
  const router = useRouter();
  const { user, loading, isAdmin } = useAuth();
  const tenant = getTenantContext();
  const allowed = canAccessDbIsuFeature(tenant, isAdmin);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
    if (!loading && user && !allowed) {
      router.replace(redirectTo);
    }
  }, [loading, user, allowed, redirectTo, router]);

  if (loading) {
    return <div className="p-6">Se încarcă…</div>;
  }
  if (!user || !allowed) return null;
  return <>{children}</>;
}
