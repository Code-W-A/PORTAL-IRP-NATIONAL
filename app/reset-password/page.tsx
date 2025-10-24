"use client";
import { useState } from "react";
import Link from "next/link";
import { initFirebase } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { AuthBackground } from "@/app/components/AuthBackground";

export default function ResetPasswordPage() {
  const { auth } = initFirebase();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const actionCodeSettings = {
        // Redirect după resetare; ajustează dacă ai alt domeniu/route
        url: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        handleCodeInApp: false,
      } as any;
      await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
      setMsg("Email de resetare trimis, verifică inbox-ul (inclusiv Spam).");
    } catch (e: any) {
      const code = e?.code || "";
      const map: Record<string, string> = {
        "auth/invalid-email": "Adresa de email nu este validă.",
        "auth/user-not-found": "Nu există cont pentru acest email.",
        "auth/missing-email": "Introduceți adresa de email.",
        "auth/too-many-requests": "Prea multe încercări. Încercați mai târziu.",
      };
      setMsg(map[code] || "Nu am putut trimite emailul de resetare. Verificați adresa și încercați din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 text-white font-bold text-lg">IRP</div>
          <h1 className="mt-3 text-2xl font-semibold text-gray-900">Resetare parolă</h1>
          <p className="text-sm text-gray-600">Primești un link de resetare pe email</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl bg-white/95 backdrop-blur-sm border border-white/50 shadow-2xl p-6">
          {msg && <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 text-blue-800 px-3 py-2 text-sm">{msg}</div>}
          <label className="block mb-1 text-sm font-medium text-gray-800">Email</label>
          <input className="w-full border border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 mb-3 text-black placeholder:text-gray-400" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors text-white py-2.5 rounded-lg disabled:opacity-60">{loading ? "Se trimite…" : "Trimite link"}</button>
          <div className="mt-4 text-center text-sm text-gray-600">
            <Link href="/login" className="text-blue-700 hover:underline">Înapoi la autentificare</Link>
          </div>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">© {new Date().getFullYear()} Portal IRP</p>
      </div>
    </AuthBackground>
  );
}


