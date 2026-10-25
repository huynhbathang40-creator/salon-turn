import { firebaseConfig } from "./firebaseConfig.js";

export const STORAGE_KEY = "salon-turn-v1";

export const INITIAL_TECHNICIANS = [
  { id: "anna", name: "Anna" },
  { id: "dee", name: "Dee" },
  { id: "tony", name: "Tony" },
  { id: "lee", name: "Lee" },
  { id: "q", name: "Q" },
];

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function createInitialData() {
  return {
    technicians: INITIAL_TECHNICIANS,
    standby: [],
    turnPosition: [],
    starredIds: [],
    history: [],
    standbyVisible: true,
    businessDate: todayString(),
  };
}

export function normalize(data) {
  const initial = createInitialData();
  const d = data || {};
  return {
    ...initial,
    ...d,
    technicians: Array.isArray(d.technicians) ? d.technicians : initial.technicians,
    standby: Array.isArray(d.standby) ? d.standby : [],
    turnPosition: Array.isArray(d.turnPosition) ? d.turnPosition : [],
    starredIds: Array.isArray(d.starredIds) ? d.starredIds : [],
    history: Array.isArray(d.history) ? d.history : [],
  };
}

export function archiveHistory(history) {
  return (history || []).map(({ beforePosition, ...rest }) => rest);
}

export function newId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function resetForNewDay(previous) {
  return {
    ...previous,
    history: [],
    standby: [],
    turnPosition: [],
    starredIds: [],
    standbyVisible: true,
    businessDate: todayString(),
  };
}

/* ---------- local (this device only) ---------- */

function readLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return { board: createInitialData(), archive: [] };
    return { board: normalize(saved.board), archive: Array.isArray(saved.archive) ? saved.archive : [] };
  } catch {
    return { board: createInitialData(), archive: [] };
  }
}

function writeLocal(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep running in memory */
  }
}

function createLocalStore() {
  let current = readLocal();
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(current.board, current.archive, null));

  // keep several tabs on the same device in step
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      current = readLocal();
      emit();
    }
  });

  return {
    mode: "local",
    subscribe(fn) {
      listeners.add(fn);
      fn(current.board, current.archive, null);
      return () => listeners.delete(fn);
    },
    async update(updater) {
      current = { ...current, board: updater(current.board) };
      writeLocal(current);
      emit();
    },
    async newDay() {
      const previous = current.board;
      const archive = previous.history.length
        ? [{ id: newId(), date: previous.businessDate, history: archiveHistory(previous.history), createdAt: Date.now() }, ...current.archive]
        : current.archive;
      current = { board: resetForNewDay(previous), archive };
      writeLocal(current);
      emit();
    },
  };
}

/* ---------- Firebase (shared between phones) ---------- */

async function createFirebaseStore() {
  const [{ initializeApp }, fs] = await Promise.all([import("firebase/app"), import("firebase/firestore")]);
  const app = initializeApp(firebaseConfig);
  // Cache on the phone so the board shows instantly on open and survives short connection drops
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  const boardRef = fs.doc(db, "salon", "board");
  const archiveCol = fs.collection(db, "salonArchive");

  let board = null;
  let archive = [];
  let error = null;
  const listeners = new Set();
  const emit = () => board && listeners.forEach((fn) => fn(board, archive, error));

  fs.onSnapshot(
    boardRef,
    (snap) => {
      board = snap.exists() ? normalize(snap.data()) : createInitialData();
      error = null;
      emit();
    },
    (e) => {
      console.error(e);
      error = e;
      if (!board) board = createInitialData();
      emit();
    }
  );
  fs.onSnapshot(
    fs.query(archiveCol, fs.orderBy("createdAt", "desc"), fs.limit(60)),
    (snap) => {
      archive = snap.docs.map((d) => d.data());
      emit();
    },
    (e) => console.error(e)
  );

  return {
    mode: "cloud",
    subscribe(fn) {
      listeners.add(fn);
      emit();
      return () => listeners.delete(fn);
    },
    async update(updater) {
      // show the change immediately, then confirm with the server
      if (board) {
        board = updater(board);
        emit();
      }
      try {
        await fs.runTransaction(db, async (tx) => {
          const snap = await tx.get(boardRef);
          const base = snap.exists() ? normalize(snap.data()) : createInitialData();
          tx.set(boardRef, updater(base));
        });
        error = null;
      } catch (e) {
        console.error(e);
        error = e;
        emit();
      }
    },
    async newDay() {
      try {
        await fs.runTransaction(db, async (tx) => {
          const snap = await tx.get(boardRef);
          const previous = snap.exists() ? normalize(snap.data()) : createInitialData();
          if (previous.history.length > 0) {
            const id = newId();
            tx.set(fs.doc(archiveCol, id), {
              id,
              date: previous.businessDate,
              history: archiveHistory(previous.history),
              createdAt: Date.now(),
            });
          }
          tx.set(boardRef, resetForNewDay(previous));
        });
      } catch (e) {
        console.error(e);
        error = e;
        emit();
      }
    },
  };
}

export const hasCloud = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export function createStore() {
  return hasCloud ? createFirebaseStore() : Promise.resolve(createLocalStore());
}
