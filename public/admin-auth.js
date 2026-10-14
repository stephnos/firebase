import { browserLocalPersistence, GoogleAuthProvider, getAuth, getRedirectResult, onAuthStateChanged, setPersistence, signInWithRedirect, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { doc, getDoc, getDocFromCache } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseApp, firebaseDb } from "/firebase-config.js?v=4";

const auth = getAuth(firebaseApp);
const db = firebaseDb;
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(error => {
  console.warn("Persistent sign-in is unavailable in this browser.", error);
});

const gate = document.querySelector("#adminAuthGate");
const adminApp = document.querySelector("#adminApp");
const signInButton = document.querySelector("#googleSignIn");
const authMessage = document.querySelector("#authMessage");
let adminModuleLoaded = false;
let pendingMessage = "";
let authCheckSequence = 0;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/admin-sw.js?v=1", { scope: "/" }).catch(error => {
    console.warn("Offline application shell is unavailable.", error);
  });
}

window.addEventListener("online", updateOfflineBanner);
window.addEventListener("offline", updateOfflineBanner);

signInButton.addEventListener("click", async () => {
  signInButton.disabled = true;
  authMessage.textContent = "Taking you to Google sign-in…";
  pendingMessage = "";
  try {
    await authPersistenceReady;
    await signInWithRedirect(auth, provider);
  } catch (error) {
    console.error(error);
    pendingMessage = friendlyAuthError(error);
    authMessage.textContent = pendingMessage;
    signInButton.disabled = false;
  }
});

authPersistenceReady.then(() => getRedirectResult(auth)).catch(error => {
  console.error(error);
  pendingMessage = friendlyAuthError(error);
  authMessage.textContent = pendingMessage;
  signInButton.disabled = false;
});

document.querySelector("#adminSignOut").addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async user => {
  const checkSequence = ++authCheckSequence;
  adminApp.hidden = true;

  if (!user || !user.emailVerified) {
    gate.hidden = false;
    authMessage.textContent = pendingMessage;
    return;
  }

  gate.hidden = false;
  authMessage.textContent = "Verifying administrator access…";

  try {
    await verifyAdminAccess();
  } catch (error) {
    if (checkSequence !== authCheckSequence) return;
    console.error(error);
    if (!navigator.onLine) {
      pendingMessage = "Connect to the internet once to verify this administrator account on this device.";
      authMessage.textContent = pendingMessage;
      return;
    }
    pendingMessage = "This Google account is not approved for Micropack administration.";
    await signOut(auth);
    return;
  }

  if (checkSequence !== authCheckSequence) return;

  gate.hidden = true;
  adminApp.hidden = false;
  updateOfflineBanner();
  document.querySelector("#adminUserEmail").textContent = user.email;
  document.querySelector("#adminUserInitials").textContent = initialsFor(user);
  if (!adminModuleLoaded) {
    adminModuleLoaded = true;
    await import("/app.js?v=38");
  }
});

async function verifyAdminAccess() {
  const probeRef = doc(db, "adminAccess", "access-probe");
  try {
    const probe = await getDoc(probeRef);
    if (!probe.exists() || probe.data().enabled !== true) throw new Error("Administrator access probe is unavailable.");
  } catch (error) {
    if (navigator.onLine) throw error;
    const cachedProbe = await getDocFromCache(probeRef);
    if (!cachedProbe.exists() || cachedProbe.data().enabled !== true) throw error;
  }
}

function updateOfflineBanner() {
  const banner = document.querySelector("#offlineBanner");
  if (!banner) return;
  banner.hidden = navigator.onLine;
}

function initialsFor(user) {
  const source = String(user.displayName || user.email || "Admin").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

