import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

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

/* ---------- Supabase (live between phone + iPad) ---------- */

const CACHE_KEY = "salon-turn-cloud-cache-v1";

async function createCloudStore() {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // Last known state from this device: the board appears instantly on open, even before the network answers
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { /* ignore */ }

  let server = cached ? { data: normalize(cached.board), version: cached.version ?? -1 } : null; // last confirmed by server
  let board = server ? server.data : null; // what is on screen (may include changes still being saved)
  let archive = cached?.archive || [];
  let error = null;
  let pending = 0;
  let queue = Promise.resolve();
  const listeners = new Set();
  const emit = () => board && listeners.forEach((fn) => fn(board, archive, error));

  const saveCache = () => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ board: server?.data, version: server?.version, archive })); } catch { /* ignore */ }
  };

  function acceptServer(row) {
    if (!row || (server && row.version < server.version)) return;
    server = { data: normalize(row.data), version: row.version };
    if (pending === 0) board = server.data;
    saveCache();
  }

  async function fetchBoard() {
    const { data, error: e } = await sb.from("board").select("data, version").eq("id", "main").single();
    if (e) throw e;
    return data;
  }

  async function refresh() {
    try {
      const [row, arch] = await Promise.all([
        fetchBoard(),
        sb.from("archive").select("*").order("created_at", { ascending: false }).limit(60),
      ]);
      acceptServer(row);
      if (!arch.error) archive = arch.data;
      error = null;
      saveCache();
    } catch (e) {
      console.error(e);
      error = e;
      if (!board) board = createInitialData();
    }
    emit();
  }

  function subscribeLive() {
    return sb
      .channel("salon-board")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "board", filter: "id=eq.main" }, (payload) => {
        acceptServer(payload.new);
        emit();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "archive" }, (payload) => {
        if (!archive.some((a) => a.id === payload.new.id)) archive = [payload.new, ...archive];
        saveCache();
        emit();
      })
      .subscribe((status) => {
        // after any (re)connection, catch up on what was missed
        if (status === "SUBSCRIBED") refresh();
      });
  }

  let channel = subscribeLive();

  // iPhone/iPad pause web apps in the background and drop the live connection: catch up when back
  const wake = () => {
    if (document.visibilityState !== "visible") return;
    refresh();
    if (channel.state !== "joined" && channel.state !== "joining") {
      sb.removeChannel(channel);
      channel = subscribeLive();
    }
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);
  window.addEventListener("pageshow", wake);

  await refresh();

  async function save(updater) {
    // optimistic concurrency: only write if nobody else changed the board meanwhile, otherwise retry on fresh data
    for (let attempt = 0; attempt < 6; attempt++) {
      const base = attempt === 0 && server ? server : await fetchBoard().then((r) => ({ data: normalize(r.data), version: r.version }));
      const next = updater(base.data);
      const { data, error: e } = await sb
        .from("board")
        .update({ data: next, version: base.version + 1, updated_at: new Date().toISOString() })
        .eq("id", "main")
        .eq("version", base.version)
        .select("data, version");
      if (e) throw e;
      if (data && data.length) {
        acceptServer(data[0]);
        return;
      }
      server = null; // stale: reload and try again
    }
    throw new Error("Could not save, please try again");
  }

  return {
    mode: "cloud",
    subscribe(fn) {
      listeners.add(fn);
      emit();
      return () => listeners.delete(fn);
    },
    update(updater) {
      // show the change right away
      board = updater(board);
      pending++;
      emit();
      queue = queue
        .then(() => save(updater))
        .then(() => { error = null; })
        .catch((e) => { console.error(e); error = e; })
        .finally(() => {
          pending--;
          if (pending === 0 && server) board = server.data;
          emit();
        });
      return queue;
    },
    newDay() {
      board = resetForNewDay(board);
      pending++;
      emit();
      queue = queue
        .then(async () => {
          const { error: e } = await sb.rpc("start_new_day", { p_today: todayString(), p_archive_id: newId() });
          if (e) throw e;
          await refresh();
        })
        .catch((e) => { console.error(e); error = e; })
        .finally(() => {
          pending--;
          if (pending === 0 && server) board = server.data;
          emit();
        });
      return queue;
    },
  };
}

export const hasCloud = Boolean(SUPABASE_URL && SUPABASE_KEY) && !import.meta.env.VITE_LOCAL_ONLY;

export function createStore() {
  return hasCloud ? createCloudStore() : Promise.resolve(createLocalStore());
}
