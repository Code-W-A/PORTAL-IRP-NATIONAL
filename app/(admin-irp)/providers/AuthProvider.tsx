"use client";
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { initFirebase } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getTenantContext, setTenantContext } from "@/lib/tenant";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, isAdmin: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const { auth } = initFirebase();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);
      setIsAdmin(false);
      try {
        if (!u) {
          setLoading(false);
          return;
        }
        const { db } = initFirebase();
        const profileRef = doc(db, `users/${u.uid}`);
        const snap = await getDoc(profileRef);
        const prof = snap.exists() ? (snap.data() as any) : null;
        const tc = getTenantContext();
        const profileJudetId = String(prof?.judetId || "");
        const profileStructuraId = String(prof?.structuraId || "");
        const activeJudetId = profileJudetId || tc.judetId;
        const activeStructuraId = profileStructuraId || tc.structuraId;
        const shouldHydrateTenant =
          !tc.judetId ||
          !tc.structuraId ||
          (tc.judetId === "DB" && tc.structuraId === "ISU");
        if (profileJudetId && profileStructuraId && (shouldHydrateTenant || tc.judetId !== profileJudetId || tc.structuraId !== profileStructuraId)) {
          setTenantContext({ judetId: profileJudetId, structuraId: profileStructuraId });
        }

        if (activeJudetId && activeStructuraId) {
          const structuraRef = doc(db, `Judete/${activeJudetId}/Structuri/${activeStructuraId}`);
          const structuraSnap = await getDoc(structuraRef);
          const structuraData = structuraSnap.exists() ? (structuraSnap.data() as any) : null;
          setIsAdmin(structuraData?.isAdmin === true);
        }
      } catch {}
      finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => ({ user, loading, isAdmin }), [user, loading, isAdmin]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
