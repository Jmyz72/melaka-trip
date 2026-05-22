import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { summarize } from "./ratings-summary.mjs";

const firebaseConfig = {
  apiKey: "AIzaSyAQyLGKURTB64x_a038gdYTxCGHYDszhj4",
  authDomain: "project-21c844a6-e5cc-4a62-920.firebaseapp.com",
  projectId: "project-21c844a6-e5cc-4a62-920",
  storageBucket: "project-21c844a6-e5cc-4a62-920.firebasestorage.app",
  messagingSenderId: "810424813381",
  appId: "1:810424813381:web:a390e6227e83c3be2be02c"
};

let app, db;
function ensureInit() {
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
}

export function getUserId() {
  let uid = localStorage.getItem("melaka_uid");
  if (!uid) {
    uid = (crypto.randomUUID && crypto.randomUUID()) ||
          ("u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("melaka_uid", uid);
  }
  return uid;
}

export { summarize };

// Subscribe to the entire `ratings` collection. `onUpdate(map)` is called
// with a Map<placeId, { my, avg, count }> on every Firestore push.
export function subscribeAll(onUpdate) {
  ensureInit();
  const uid = getUserId();
  return onSnapshot(collection(db, "ratings"), snap => {
    const out = new Map();
    snap.forEach(d => {
      const by = d.data().by || {};
      out.set(d.id, { ...summarize(by, uid), by });
    });
    onUpdate(out);
  });
}

// Write/update my rating for one place.
export async function setRating(placeId, stars) {
  ensureInit();
  const uid = getUserId();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error(`stars must be integer 1..5, got ${stars}`);
  }
  await setDoc(doc(db, "ratings", placeId), { by: { [uid]: stars } }, { merge: true });
}
