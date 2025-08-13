"use client";
import { useState } from "react";
import Link from "next/link";
import { initFirebase } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AuthBackground } from "@/app/components/AuthBackground";

export default function LoginPage() {
  const { auth } = initFirebase();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/lista-BICP");
    } catch (err: any) {
      setError("Email sau parolă incorecte.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 text-white font-bold text-lg">IRP</div>
          <h1 className="mt-3 text-2xl font-semibold text-gray-900">Autentificare</h1>
          <p className="text-sm text-gray-600">Accesează portalul intern pentru BI/CP</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl bg-white/95 backdrop-blur-sm border border-white/50 shadow-2xl p-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm" role="alert">
              {error}
            </div>
          )}
          <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-800">Email</label>
          <input
            id="email"
            className="w-full border border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 mb-4 outline-none text-black placeholder:text-gray-400"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="password" className="block mb-1 text-sm font-medium text-gray-800">Parolă</label>
          <div className="relative mb-4">
            <input
              id="password"
              className="w-full border border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 pr-10 outline-none text-black placeholder:text-gray-400"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              aria-label={showPass ? "Ascunde parola" : "Afișează parola"}
              onClick={() => setShowPass((v) => !v)}
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                {showPass ? (
                  <path d="M2 2l20 20M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-3.42M6.4 6.4C4.6 7.7 3.1 9.5 2 12c2.2 5 7 8 10 8 1.6 0 3.2-.5 4.7-1.4M17.6 17.6C19.4 16.3 20.9 14.5 22 12c-2.2-5-7-8-10-8-1.1 0-2.2.2-3.2.6" />
                ) : (
                  <>
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors text-white py-2.5 rounded-lg font-medium disabled:opacity-60"
          >
            {loading ? "Se conectează…" : "Intră"}
          </button>
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <Link href="/reset-password" className="text-blue-700 hover:underline">Ai uitat parola?</Link>
            <div>
              <span>Nu ai cont? </span>
              <Link href="/register" className="text-blue-700 hover:underline">Creează cont</Link>
            </div>
          </div>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">© {new Date().getFullYear()} Portal IRP</p>
      </div>
    </AuthBackground>
  );
}


