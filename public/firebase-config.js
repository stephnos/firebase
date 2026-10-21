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

export const firebaseApp = getApps()[0] || initializeApp(firebaseConfig);

initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaV3Provider("6LcIdpMtAAAAAFbfjJQVEe4YV_0UQrWv1oFkhaun"),
  isTokenAutoRefreshEnabled: true
});

try {
  initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (error) {
  console.warn("Persistent Firestore cache is unavailable; using the in-memory cache.", error);
}

export const firebaseDb = getFirestore(firebaseApp);
