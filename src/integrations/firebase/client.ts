import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_placeholder",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "placeholder.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "placeholder-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "placeholder-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "0000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000:web:000",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export type Cert = {
  id: string;
  certificate_id: string;
  participant_name: string;
  team_name: string | null;
  project_name: string | null;
  role: string;
  college: string | null;
  email: string | null;
  certificate_type: string;
  event_name: string;
  event_date: string | null;
  status: string;
  revoke_reason: string | null;
  issued_at: string;
  scan_count: number;
};
