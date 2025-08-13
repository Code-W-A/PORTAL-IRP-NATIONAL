import type { Metadata } from "next";
import { AuthProvider } from "@/app/(admin-irp)/providers/AuthProvider";
import Protected from "@/app/(admin-irp)/components/Protected";
import { TopNavbar, BottomNavbar } from "@/app/(admin-irp)/components/Navbar";

export const metadata: Metadata = {
  title: "Portal IRP",
  description: "BICP & OZU",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Protected>
        <TopNavbar />
                  <div className="mx-auto px-4 py-4 pb-20">{children}</div>
        <BottomNavbar />
      </Protected>
    </AuthProvider>
  );
}


