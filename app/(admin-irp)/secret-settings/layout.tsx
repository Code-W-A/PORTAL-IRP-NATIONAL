import Protected from "@/app/(admin-irp)/components/Protected";

export default function SecretSettingsLayout({ children }: { children: React.ReactNode }) {
  return <Protected requireAdmin redirectTo="/403">{children}</Protected>;
}
