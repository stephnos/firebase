import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseDb } from "/firebase-config.js?v=4";
import { DEFAULT_OPENING, normalizeOpening } from "/openings.js?v=32";

const db = firebaseDb;
const resumeChunkSize = 340000;

export function listenToOpenings(onData, onError) {
  return onSnapshot(collection(db, "openings"), snapshot => {
    const openings = snapshot.docs.map(item => normalizeOpening({ id: item.id, ...item.data() }));
    onData(openings.length ? openings : [DEFAULT_OPENING]);
  }, onError);
}

export function listenToApplications(onData, onError) {
  const applicationsQuery = query(collection(db, "applications"), orderBy("submittedAt", "desc"));
  return onSnapshot(applicationsQuery, snapshot => {
    onData(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
  }, onError);
}

