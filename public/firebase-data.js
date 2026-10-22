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

export async function ensureDefaultOpening() {
  const openingRef = doc(db, "openings", DEFAULT_OPENING.id);
  if (!(await getDoc(openingRef)).exists()) await setDoc(openingRef, DEFAULT_OPENING);
}

export async function saveSharedOpening(opening) {
  await setDoc(doc(db, "openings", opening.id), normalizeOpening(opening));
}

export async function createSharedApplication(record, resumeData) {
  const chunks = splitIntoChunks(String(resumeData || ""));
  const batch = writeBatch(db);
  const applicationRef = doc(db, "applications", record.id);
  batch.set(applicationRef, {
    ...withoutUndefined(record),
    submittedAt: serverTimestamp(),
    resumeChunkCount: chunks.length,
    resumeDataLength: String(resumeData || "").length
  });
  chunks.forEach((data, index) => {
    batch.set(doc(applicationRef, "resumeChunks", String(index).padStart(4, "0")), {
      applicationId: record.id,
      index,
      data
    });
  });
  await batch.commit();
}

export async function loadSharedResume(applicationId) {
  const chunksQuery = query(collection(db, "applications", applicationId, "resumeChunks"), orderBy("index", "asc"));
  const snapshot = await getDocs(chunksQuery);
  return snapshot.docs.map(item => item.data().data || "").join("");
}

export async function updateSharedApplication(applicationId, changes) {
  const safeChanges = { ...changes };
  delete safeChanges.id;
  delete safeChanges.resumeData;
  await updateDoc(doc(db, "applications", applicationId), withoutUndefined(safeChanges));
}

export async function deleteSharedApplication(applicationId) {
  const applicationRef = doc(db, "applications", applicationId);
  const chunks = await getDocs(collection(applicationRef, "resumeChunks"));
  const batch = writeBatch(db);
  chunks.docs.forEach(item => batch.delete(item.ref));
  batch.delete(applicationRef);
  await batch.commit();
}

function splitIntoChunks(value) {
  const chunks = [];
  for (let index = 0; index < value.length; index += resumeChunkSize) chunks.push(value.slice(index, index + resumeChunkSize));
  return chunks;
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
