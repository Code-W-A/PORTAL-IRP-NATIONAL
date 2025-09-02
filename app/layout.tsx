import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { initClientLogger } from "@/lib/client-logger";
import dynamic from "next/dynamic";

const PwaInstallPrompt = dynamic(() => import("@/app/components/PwaInstallPrompt"), { ssr: false });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal IRP",
  description: "BICP & OZU",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (typeof window !== "undefined") {
    initClientLogger();
  }
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/logo-aplicatie/sigla-aplicatie-svg.svg" />
        <link rel="apple-touch-icon" href="/logo-aplicatie/sigla-aplicatie.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <PwaInstallPrompt />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(e) { console.log('SW reg failed', e); });
            });
          }
        `}} />
      </body>
    </html>
  );
}
