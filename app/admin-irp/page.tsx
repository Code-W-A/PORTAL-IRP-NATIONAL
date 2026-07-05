"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";

import { AuthBackground } from "@/app/components/AuthBackground";
import { initFirebase } from "@/lib/firebase";

type StatusState = {
  ok: boolean;
  message: string;
} | null;

function mapLoginError() {
  return "Email sau parolă incorecte.";
}

export default function AdminIrpPage() {
  const { auth } = useMemo(() => initFirebase(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [targetEmail, setTargetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);
  const [submitBusy, setSubmitBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError(null);
    setLoginBusy(true);

    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      setLoginPassword("");
    } catch {
      setLoginError(mapLoginError());
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);

    if (!user) {
      setStatus({ ok: false, message: "Trebuie să fii autentificat." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({ ok: false, message: "Parolele nu coincid." });
      return;
    }

    if (newPassword.length < 6) {
      setStatus({ ok: false, message: "Parola nouă trebuie să aibă minimum 6 caractere." });
      return;
    }

    if (!confirmIntent) {
      setStatus({ ok: false, message: "Confirmă explicit schimbarea parolei." });
      return;
    }

    setSubmitBusy(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin-irp/change-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetEmail: targetEmail.trim(),
          newPassword,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Nu am putut schimba parola.");
      }

      setStatus({ ok: true, message: data.message || "Parola a fost actualizată." });
      setTargetEmail("");
      setNewPassword("");
      setConfirmPassword("");
      setConfirmIntent(false);
    } catch (error: any) {
      setStatus({ ok: false, message: error?.message || "Nu am putut schimba parola." });
    } finally {
      setSubmitBusy(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setStatus(null);
  }

  if (authLoading) {
    return (
      <AuthBackground>
        <div className="rounded-2xl border border-white/60 bg-white/95 p-6 shadow-xl">
          <div className="flex items-center gap-3 text-gray-700">
            <Loader2 className="h-5 w-5 animate-spin" />
            Se verifică sesiunea...
          </div>
        </div>
      </AuthBackground>
    );
  }

  if (!user) {
    return (
      <AuthBackground>
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-gray-900">Admin IRP</h1>
            <p className="text-sm text-gray-600">Acces ascuns pentru adminul aplicației DB / ISU</p>
          </div>

          <form onSubmit={handleLogin} className="rounded-2xl border border-white/50 bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
            {loginError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {loginError}
              </div>
            )}

            <label htmlFor="admin-irp-email" className="mb-1 block text-sm font-medium text-gray-800">
              Email admin
            </label>
            <input
              id="admin-irp-email"
              type="email"
              autoComplete="username"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-black outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              required
            />

            <label htmlFor="admin-irp-password" className="mb-1 block text-sm font-medium text-gray-800">
              Parolă
            </label>
            <div className="relative mb-6">
              <input
                id="admin-irp-password"
                type={showLoginPassword ? "text" : "password"}
                autoComplete="current-password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-black outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                required
              />
              <button
                type="button"
                aria-label={showLoginPassword ? "Ascunde parola" : "Afișează parola"}
                onClick={() => setShowLoginPassword((value) => !value)}
                className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
              >
                {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loginBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loginBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loginBusy ? "Se autentifică..." : "Intră"}
            </button>
          </form>
        </div>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <main className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-gray-900">Resetare parole conturi</h1>
          <p className="text-sm text-gray-600">Operațiune disponibilă doar pentru adminul aplicației DB / ISU.</p>
        </div>

        <form onSubmit={handleChangePassword} className="rounded-2xl border border-white/50 bg-white/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-5 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Autentificat ca <span className="font-semibold">{user.email || "admin"}</span>
            </div>
            <button type="button" onClick={handleLogout} className="text-left font-medium text-blue-700 hover:underline sm:text-right">
              Deconectare
            </button>
          </div>

          {status && (
            <div className={`mb-5 rounded-lg border px-3 py-2 text-sm ${
              status.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {status.message}
            </div>
          )}

          <label htmlFor="target-email" className="mb-1 block text-sm font-medium text-gray-800">
            Email cont țintă
          </label>
          <input
            id="target-email"
            type="email"
            autoComplete="off"
            value={targetEmail}
            onChange={(event) => setTargetEmail(event.target.value)}
            placeholder="cont@exemplu.ro"
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-black outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-800">
                Parolă nouă
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-black outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  aria-label={showNewPassword ? "Ascunde parola" : "Afișează parola"}
                  onClick={() => setShowNewPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-800">
                Confirmă parola
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-black outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Ascunde parola" : "Afișează parola"}
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={confirmIntent}
              onChange={(event) => setConfirmIntent(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            Confirm că vreau să schimb parola acestui cont. Operațiunea se aplică direct în Firebase Auth.
          </label>

          <button
            type="submit"
            disabled={submitBusy || !targetEmail.trim() || !newPassword || newPassword !== confirmPassword || !confirmIntent}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {submitBusy ? "Se actualizează..." : "Schimbă parola"}
          </button>
        </form>
      </main>
    </AuthBackground>
  );
}
