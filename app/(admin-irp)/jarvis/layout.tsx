import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono } from "next/font/google";

const jarvisDisplay = Orbitron({
  subsets: ["latin"],
  variable: "--font-jarvis-display",
});

const jarvisMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-jarvis-mono",
});

export const metadata: Metadata = {
  title: "JARVIS IRP",
  description: "Command center IRP — astăzi, operativ, 544, raportări",
};

export default function JarvisLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${jarvisDisplay.variable} ${jarvisMono.variable}`}>{children}</div>;
}
