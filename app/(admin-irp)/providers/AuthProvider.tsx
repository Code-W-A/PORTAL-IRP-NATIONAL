"use client";
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { initFirebase } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getTenantContext, setTenantContext } from "@/lib/tenant";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const { auth } = initFirebase();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      try {
        if (u) {
          const tc = getTenantContext();
          if (!tc.judetId || !tc.structuraId || tc.judetId === "DB" && tc.structuraId === "ISU") {
            const { db } = initFirebase();
            const profileRef = doc(db, `users/${u.uid}`);
            const snap = await getDoc(profileRef);
            const prof = snap.exists() ? (snap.data() as any) : null;
            if (prof?.judetId && prof?.structuraId) {
              setTenantContext({ judetId: prof.judetId, structuraId: prof.structuraId });
            }
          }
        }
      } catch {}
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}


