"use client";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault?.();
      try { (window as any).__pwaDeferredPrompt = e as BeforeInstallPromptEvent; } catch {}
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    // Hide if already in standalone
    if (typeof window !== "undefined") {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
      if (isStandalone) return;
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall as any);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall as any);
  }, []);

  if (!visible || !deferred) return null;

  async function install() {
    try {
      setInstalling(true);
      if (!deferred) return; // type guard
      await deferred.prompt();
      await deferred.userChoice;
    } catch {}
    setInstalling(false);
    try { (window as any).__pwaDeferredPrompt = null; } catch {}
    setDeferred(null);
    setVisible(false);
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]">
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white shadow-lg px-4 py-3">
        <img src="/logo-aplicatie/sigla-aplicatie-svg.svg" alt="IRP" className="w-6 h-6" />
        <div className="text-sm text-gray-800">Instalează aplicația pe dispozitiv</div>
        <button
          onClick={install}
          disabled={installing}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${installing ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
        >
          {installing ? "Se instalează..." : "Instalează"}
        </button>
        <button
          onClick={() => { /* păstrăm deferred în window pentru instalare ulterioară din Setări */ setVisible(false); }}
          className="px-2 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Nu acum
        </button>
      </div>
    </div>
  );
}


