import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const storage = {
  async get(key) {
    const snap = await getDoc(doc(db, "kv", key));
    if (!snap.exists()) return null;
    return { key, value: snap.data().value };
  },

  async set(key, value) {
    await setDoc(doc(db, "kv", key), { value });
    return { key, value };
  },

  async delete(key) {
    await deleteDoc(doc(db, "kv", key));
    return { key, deleted: true };
  },

  async list(prefix) {
    const snap = await getDocs(collection(db, "kv"));
    const keys = snap.docs.map((d) => d.id).filter((id) => id.startsWith(prefix));
    return { keys };
  },
};
