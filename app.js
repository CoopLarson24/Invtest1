import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  INVENTORY_TABLE,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./config.js";

const DB_NAME = "herd-directory-db";
const DB_VERSION = 1;
const STORE_NAME = "animals";
const META_STORE = "meta";

const searchInput = document.getElementById("search");
const results = document.getElementById("results");
const syncButton = document.getElementById("syncButton");
const syncStatus = document.getElementById("syncStatus");
const lastSyncLabel = document.getElementById("lastSync");
const connectionLabel = document.getElementById("connection");
const template = document.getElementById("animalTemplate");

const supabaseConfigured =
  !SUPABASE_URL.includes("YOUR_PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY");

const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let animals = [];

const formatDate = (raw) => {
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readAnimalsFromCache() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function saveAnimalsToCache(records) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, META_STORE], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const metaStore = tx.objectStore(META_STORE);

    store.clear();
    for (const row of records) {
      store.put(row);
    }

    metaStore.put({ key: "lastSync", value: new Date().toISOString() });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readLastSync() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).get("lastSync");

    req.onsuccess = () => resolve(req.result?.value || null);
    req.onerror = () => reject(req.error);
  });
}

async function fetchAnimalsFromSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Update config.js.");
  }

  const { data, error } = await supabase
    .from(INVENTORY_TABLE)
    .select(
      "id, tag_number, name, breed, sex, birth_date, lot, status, pregnancy_result, updated_at",
    )
    .order("tag_number", { ascending: true });

  if (error) throw error;
  return data || [];
}

function render(list) {
  results.innerHTML = "";

  if (!list.length) {
    results.innerHTML = `<div class="empty-state">No animals found.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const animal of list) {
    const node = template.content.cloneNode(true);
    node.querySelector(".tag").textContent = animal.tag_number || `ID ${animal.id}`;
    node.querySelector(".name").textContent = animal.name || "—";
    node.querySelector(".breed").textContent = animal.breed || "—";
    node.querySelector(".sex").textContent = animal.sex || "—";
    node.querySelector(".birthDate").textContent = formatDate(animal.birth_date);
    node.querySelector(".lot").textContent = animal.lot || "—";
    node.querySelector(".status").textContent = animal.status || "—";
    node.querySelector(".pregnancy").textContent = animal.pregnancy_result || "—";
    fragment.append(node);
  }

  results.append(fragment);
}

function applyFilter() {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) {
    render(animals);
    return;
  }

  const filtered = animals.filter((row) => {
    return [
      row.tag_number,
      row.name,
      row.breed,
      row.lot,
      row.status,
      row.pregnancy_result,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  render(filtered);
}

function setSyncState(message, isBusy = false) {
  syncStatus.textContent = message;
  syncButton.disabled = isBusy;
}

function updateConnectionLabel() {
  connectionLabel.textContent = navigator.onLine ? "Online" : "Offline";
}

async function syncData() {
  setSyncState("Syncing…", true);

  try {
    if (!navigator.onLine) {
      setSyncState("Offline: loaded local cache");
      return;
    }

    const fresh = await fetchAnimalsFromSupabase();
    await saveAnimalsToCache(fresh);
    animals = fresh;
    applyFilter();

    const lastSync = await readLastSync();
    lastSyncLabel.textContent = lastSync ? new Date(lastSync).toLocaleString() : "Never";
    setSyncState(`Synced ${fresh.length} records`);
  } catch (error) {
    console.error(error);
    setSyncState(`Sync failed: ${error.message || "Unknown error"}`);
  } finally {
    syncButton.disabled = false;
  }
}

async function loadInitial() {
  updateConnectionLabel();

  try {
    animals = await readAnimalsFromCache();
    applyFilter();

    const lastSync = await readLastSync();
    lastSyncLabel.textContent = lastSync ? new Date(lastSync).toLocaleString() : "Never";

    if (animals.length) {
      setSyncState(`Loaded ${animals.length} cached records`);
    } else {
      setSyncState("Cache empty");
    }
  } catch (error) {
    console.error(error);
    setSyncState("Failed to open local cache");
  }

  if (navigator.onLine) {
    await syncData();
  }
}

searchInput.addEventListener("input", applyFilter);
syncButton.addEventListener("click", syncData);
window.addEventListener("online", () => {
  updateConnectionLabel();
  syncData();
});
window.addEventListener("offline", updateConnectionLabel);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}

loadInitial();
