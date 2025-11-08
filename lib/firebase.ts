// Firebase configuration
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD8sSB2Staq9nkPW_tcAzfcPXZbjIlWJcM",
  authDomain: "buildmate-550d6.firebaseapp.com",
  projectId: "buildmate-550d6",
  storageBucket: "buildmate-550d6.firebasestorage.app",
  messagingSenderId: "110409807055",
  appId: "1:110409807055:web:499991ed7a0a973f8933ba",
  measurementId: "G-QVGELQSZY0"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
