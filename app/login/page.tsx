"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { initFirebase } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { setTenantContext } from "@/lib/tenant";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import "./login.css";
import {
  getLoginAudioPlaying,
  startLoginAudio,
  stopLoginAudio,
  subscribeLoginAudio,
  toggleLoginAudioMuted,
} from "./loginAudio";

export default function LoginPage() {
  const { auth } = initFirebase();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioOn, setAudioOn] = useState(false);

  useEffect(() => {
    const unsub = subscribeLoginAudio(() => {
      setAudioOn(getLoginAudioPlaying());
    });

    void startLoginAudio();

    return () => {
      unsub();
      stopLoginAudio();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      try {
        const { db } = initFirebase();
        const profileRef = doc(db, `users/${cred.user.uid}`);
        const profileSnap = await getDoc(profileRef);
        const prof = profileSnap.exists() ? (profileSnap.data() as any) : null;
        if (prof?.judetId && prof?.structuraId) {
          setTenantContext({ judetId: prof.judetId, structuraId: prof.structuraId });
        }
      } catch {}
      router.replace("/lista-BICP");
    } catch (err: any) {
      setError("Email sau parolă incorecte.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="login-sci"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest(".login-mute")) return;
        void startLoginAudio();
      }}
    >
      <span className="login-orb login-orb-a" aria-hidden />
      <span className="login-orb login-orb-b" aria-hidden />
      <button
        type="button"
        className="login-mute"
        onClick={() => toggleLoginAudioMuted()}
        aria-pressed={!audioOn}
        aria-label={audioOn ? "Oprește muzica" : "Pornește muzica"}
      >
        {audioOn ? "Mut" : "Sunet"}
      </button>
      <div className="login-panel">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-sky-600 text-white font-bold text-lg">IRP</div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-100">Autentificare</h1>
        </div>
        <form onSubmit={onSubmit} className="login-card">
          {error && (
            <div className="mb-4 rounded-md border border-red-400/40 bg-red-950/50 text-red-200 px-3 py-2 text-sm" role="alert">
              {error}
            </div>
          )}
          <label htmlFor="email" className="login-label">Email</label>
          <input
            id="email"
            className="login-input mb-4"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="password" className="login-label">Parolă</label>
          <div className="relative mb-6">
            <input
              id="password"
              className="login-input pr-10"
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
              className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-200"
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
          <button disabled={loading} className="login-submit">
            {loading ? "Se conectează…" : "Intră"}
          </button>
          <div className="space-y-3 text-sm text-slate-400">
            <div className="text-center">
              <Link href="/reset-password" className="login-link">Ai uitat parola?</Link>
            </div>
            <div className="text-center">
              <span>Nu ai cont? </span>
              <Link href="/register" className="login-link">Creează cont</Link>
            </div>
          </div>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} Portal IRP</p>
      </div>
    </div>
  );
}
