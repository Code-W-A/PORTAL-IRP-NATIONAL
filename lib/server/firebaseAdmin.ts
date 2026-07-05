import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type FirebaseAdminServices = {
  app: App;
  auth: Auth;
  db: Firestore;
};

let services: FirebaseAdminServices | null = null;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function getPrivateKey() {
  return requiredEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");
}

export function getFirebaseAdmin(): FirebaseAdminServices {
  if (services) return services;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("missing_env:FIREBASE_ADMIN_PROJECT_ID");

  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: requiredEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
        privateKey: getPrivateKey(),
      }),
      projectId,
    });

  services = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };

  return services;
}
