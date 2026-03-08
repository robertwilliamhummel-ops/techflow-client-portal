import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyAXjjNSClbsrtmMAbB_KuOEX8EnOn5N_0k",
  authDomain: "techflow-website-2026.firebaseapp.com",
  projectId: "techflow-website-2026",
  storageBucket: "techflow-website-2026.firebasestorage.app",
  messagingSenderId: "904705508663",
  appId: "1:904705508663:web:f1847a3d6d86abaa5e46b2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export default app;