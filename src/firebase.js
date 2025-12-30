// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAbN9T0Jr0hujoMGfs0h2m5Bf-B9PVCnhw",
    authDomain: (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'))
        ? window.location.hostname
        : "work-travel-expenses.firebaseapp.com",
    projectId: "work-travel-expenses",
    storageBucket: "work-travel-expenses.firebasestorage.app",
    messagingSenderId: "249344389548",
    appId: "1:249344389548:web:0a0c1e0543f1028fdd8a09",
    measurementId: "G-CQV1KW5WFN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);