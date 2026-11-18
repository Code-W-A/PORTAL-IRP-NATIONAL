import type { ReactNode } from "react";
import { GuidePreferencesProvider } from "@/components/ghid-comunicare/GuidePreferences";

export default function GuideLayout({ children }: { children: ReactNode }) {
  return <GuidePreferencesProvider>{children}</GuidePreferencesProvider>;
}
