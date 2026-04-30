// ─── Firebase ───────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import { createClient } from "@supabase/supabase-js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAS76Do7ABtWxhEzxSf9t2FVycuK5lD1vQ",
  authDomain: "proyecto-recordatorios.firebaseapp.com",
  projectId: "proyecto-recordatorios",
  storageBucket: "proyecto-recordatorios.firebasestorage.app",
  messagingSenderId: "1085043559876",
  appId: "1:1085043559876:web:f19f35602d717950f9e891",
  measurementId: "G-HFTX7HF30R",
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
export const twitterProvider = new TwitterAuthProvider();

const supabaseUrl = "https://xqmysxdidamfqjxwnxqx.supabase.co";
const supabaseKey = "sb_publishable_dfKiSXCeNv6S1Hgy36YfLg_4RAJNAr_";
export const supabase = createClient(supabaseUrl, supabaseKey);

// UID del administrador
export const ADMIN_UID = "e1VzSo0tQqWIbZ0PtGx0N2zE84E3";

export {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
};

// ─── Vue + Router ────────────────────────────────────────────────────────────
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import App from "./App.vue";
import LandingPage from "./components/LandingPage.vue";
import Recordatorios from "./components/Recordatorios.vue";

const routes = [
  { path: "/", component: LandingPage },
  {
    path: "/recordatorios",
    component: Recordatorios,
    meta: { requiresAuth: true },
  },
  {
    path: "/administracion",
    component: () => import("./components/Administracion.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

const esperarAuth = () =>
  new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });

router.beforeEach(async (to) => {
  const user = await esperarAuth();

  // Sin sesión → login
  if (to.meta.requiresAuth && !user) return "/";

  // Con sesión en landing → recordatorios
  if (to.path === "/" && user) return "/recordatorios";

  // Ruta de admin: solo el UID hardcodeado puede entrar
  if (to.meta.requiresAdmin && user?.uid !== ADMIN_UID) return "/recordatorios";
});

const app = createApp(App);
app.use(router);
app.mount("#app");
