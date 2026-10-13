import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app-check.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export const firebaseConfig = {
  projectId: "stephanos-firebase-site",
  appId: "1:705131306248:web:52dcf5ca46a1cc886de0bd",
  storageBucket: "stephanos-firebase-site.firebasestorage.app",
  apiKey: "AIzaSyDwdcuYOSK75ZEoRYGH588qlnfcCWNHwjI",
  authDomain: "stephanos-firebase-site.web.app",
  messagingSenderId: "705131306248"
};

