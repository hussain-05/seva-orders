// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCqkXpuM1MYeGG7lHP-DpxwxBXf2ehfblM",
  authDomain: "seva-app-2387e.firebaseapp.com",
  projectId: "seva-app-2387e",
  storageBucket: "seva-app-2387e.firebasestorage.app",
  messagingSenderId: "584758040794",
  appId: "1:584758040794:web:3409e19322e76ca2aaade3",
  measurementId: "G-7EGSKD6G0P"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);