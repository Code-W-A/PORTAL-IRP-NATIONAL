import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

export function initFirebase(): FirebaseServices {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };

  const existing = getApps()[0];
  const app = existing || initializeApp(firebaseConfig);
  const auth = getAuth(app);
  try {
    // Localize Firebase Auth flows (emails, errors) to the device/browser language
    auth.useDeviceLanguage();
  } catch {}
  const db = getFirestore(app);
  if (!existing && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
    if (!firebaseConfig.projectId.startsWith("demo-")) throw new Error("Emulatorul necesită un proiect demo.");
    connectAuthEmulator(auth, "http://127.0.0.1:9098", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8088);
  }
  return { app, auth, db };
}


