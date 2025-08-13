"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { initFirebase } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { JUDETE, getStructuriForJudet } from "@/lib/judete";
import { setTenantContext } from "@/lib/tenant";
import { AuthBackground } from "@/app/components/AuthBackground";

export default function RegisterPage() {
  const { auth, db } = initFirebase();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [judetId, setJudetId] = useState("");
  const [structuraId, setStructuraId] = useState<string | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ensureUniqueTenant(j: string, s: string) {
    // un singur cont per structură în acel județ: verificăm dacă există deja "owner"
    const ref = doc(db, `Judete/${j}/Structuri/${s}/Settings/owner`);
    const snap = await getDoc(ref);
    return !snap.exists();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!judetId || !structuraId) {
      setError("Selectați județul și structura");
      return;
    }
    if (password !== confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }
    setLoading(true);
    try {
      const unique = await ensureUniqueTenant(judetId, structuraId);
      if (!unique) {
        setError("Există deja un cont pentru această structură în județ.");
        setLoading(false);
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // marchează ownerul structurii
      await setDoc(doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/owner`), {
        uid: cred.user.uid,
        createdAt: new Date().toISOString(),
      });
      // date profil minimal
      await setDoc(doc(db, `users/${cred.user.uid}`), { judetId, structuraId, role: "admin" }, { merge: true });

      // setează context și redirect la setări structură
      setTenantContext({ judetId, structuraId });
      router.replace("/setari-structura");
    } catch (e: any) {
      setError("Înregistrare eșuată");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 text-white font-bold text-lg">IRP</div>
          <h1 className="mt-3 text-2xl font-semibold text-gray-900">Creează cont</h1>
          <p className="text-sm text-gray-600">Selectează județul și structura, apoi finalizează contul</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl bg-white/95 backdrop-blur-sm border border-white/50 shadow-2xl p-6">
        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
        <label className="block mb-1 text-sm font-medium text-gray-800">Email</label>
        <input className="w-full border border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 mb-3 text-black placeholder:text-gray-400" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="block mb-1 text-sm font-medium text-gray-800">Parolă</label>
        <div className="relative mb-3">
          <input className="w-full border border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 pr-10 text-black placeholder:text-gray-400" type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" aria-label={showPass ? "Ascunde parola" : "Afișează parola"} onClick={() => setShowPass((v) => !v)} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700">
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
        <label className="block mb-1 text-sm font-medium text-gray-800">Confirmă parola</label>
        <div className="relative mb-3">
          <input className="w-full border border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 pr-10 text-black placeholder:text-gray-400" type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <button type="button" aria-label={showConfirm ? "Ascunde parola" : "Afișează parola"} onClick={() => setShowConfirm((v) => !v)} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              {showConfirm ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">Județ</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black" value={judetId} onChange={(e) => setJudetId(e.target.value)} required>
              <option value="">Selectează județ</option>
              {JUDETE.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">Structură</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black" value={structuraId} onChange={(e) => setStructuraId(e.target.value)} required>
              <option value="">Selectează structură</option>
              {getStructuriForJudet(judetId || "").map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
        </div>
        <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors text-white py-2.5 rounded-lg disabled:opacity-60">{loading ? "Se creează…" : "Creează cont"}</button>
        <div className="mt-4 text-center text-sm text-gray-600">
          <span>Ai deja cont? </span>
          <Link href="/login" className="text-blue-700 hover:underline">Autentifică-te</Link>
        </div>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">© {new Date().getFullYear()} Portal IRP</p>
      </div>
    </AuthBackground>
  );
}


