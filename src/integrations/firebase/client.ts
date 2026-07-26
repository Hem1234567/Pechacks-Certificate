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
  templateId?: string | null;   // explicit template link (overrides role/type auto-match)
};

// ─── Template Builder Types ───────────────────────────────────────────────────

export type FieldConfig = {
  id: string;              // e.g. "participant_name" | "role" | "qr" | custom uuid
  label: string;           // display label in editor
  fieldKey: string;        // maps to Cert property key, or "qr" for QR block
  x: number;               // percent from left (0–100)
  y: number;               // percent from top (0–100)
  width: number;           // percent width (0–100)
  height: number;          // percent height (0–100)
  fontFamily: string;
  fontSize: number;        // px
  fontWeight: string;      // "300" | "400" | "600" | "700" | "800"
  color: string;           // hex
  textAlign: "left" | "center" | "right";
  letterSpacing: string;   // e.g. "0.1em"
  textTransform: "none" | "uppercase" | "capitalize";
  italic: boolean;
  visible: boolean;
};

export type QRStyleConfig = {
  dotsType: "rounded" | "dots" | "classy" | "classy-rounded" | "square" | "extra-rounded";
  dotsColor: string;       // hex
  backgroundColor: string; // hex, or "transparent"
  cornersSquareType: "dot" | "square" | "extra-rounded";
  cornersDotType: "dot" | "square";
  useGradient: boolean;
  gradientType: "linear" | "radial";
  gradientFrom: string;    // hex
  gradientTo: string;      // hex
  gradientRotation: number; // degrees
  centerLogoUrl: string;   // data URL or remote URL, empty = no logo
  size: number;            // px
};

export type CertificateTemplate = {
  id: string;
  name: string;
  backgroundUrl: string;   // base64 data URL or Cloudinary URL
  fields: FieldConfig[];
  qrConfig: QRStyleConfig;
  applyToRoles: string[];  // empty = applies to all roles
  applyToTypes: string[];  // empty = applies to all types
  createdAt: string;
  updatedAt: string;
};
