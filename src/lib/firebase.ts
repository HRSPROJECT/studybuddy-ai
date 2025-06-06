import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBnqRx88_zhzrCO_9L5fYoJ2kOwMEWQglM",
  authDomain: "studybuddy2-ae2ec.firebaseapp.com",
  projectId: "studybuddy2-ae2ec",
  storageBucket: "studybuddy2-ae2ec.appspot.com", // Corrected from firebasestorage.app
  messagingSenderId: "384941937722",
  appId: "1:384941937722:web:f2a6200db4f881d2c49103",
  measurementId: "G-DYT3B4T8F1"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getDatabase(app);

export { app, auth, db };
