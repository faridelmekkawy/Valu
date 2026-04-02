const firebaseConfig = { apiKey: 'REPLACE_ME', authDomain: 'REPLACE_ME', projectId: 'REPLACE_ME' };

const OFFLINE_QUEUE_KEY = 'pacmansave_offline_queue_v1';
const PACMAN_COLLECTION = 'pacmansave';

let firestoreApi = null;
let db = null;

function hasValidConfig() {
  return !Object.values(firebaseConfig).includes('REPLACE_ME');
}

export function isFirestoreReady() {
  return Boolean(db && firestoreApi);
}

export async function initFirestore() {
  if (isFirestoreReady()) return { ready: true };
  if (!hasValidConfig()) return { ready: false, reason: 'missing-config' };

  try {
    const [{ initializeApp }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);

    const app = initializeApp(firebaseConfig);
    db = firestore.getFirestore(app);
    firestoreApi = firestore;
    return { ready: true };
  } catch (error) {
    console.warn('Firestore initialization failed.', error);
    return { ready: false, reason: 'init-failed', error };
  }
}

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function enqueueOperation(op) {
  const queue = loadQueue();
  queue.push({
    ...op,
    queuedAt: Date.now()
  });
  saveQueue(queue);
}

export function queuedOperationCount() {
  return loadQueue().length;
}

async function writeSession(docId, payload, merge = true) {
  const docRef = firestoreApi.doc(db, PACMAN_COLLECTION, docId);
  await firestoreApi.setDoc(docRef, payload, { merge });
}

export async function upsertSessionWithQueue(docId, payload, options = {}) {
  const merge = options.merge !== false;

  if (!isFirestoreReady()) {
    enqueueOperation({ docId, payload, merge });
    return { queued: true };
  }

  try {
    await writeSession(docId, payload, merge);
    return { queued: false };
  } catch (error) {
    console.warn('Could not write to Firestore. Queuing operation.', error);
    enqueueOperation({ docId, payload, merge });
    return { queued: true, error };
  }
}

export async function flushQueuedSessionOps() {
  if (!isFirestoreReady()) return { flushed: 0, remaining: queuedOperationCount() };

  const queue = loadQueue();
  if (!queue.length) return { flushed: 0, remaining: 0 };

  let flushed = 0;
  const remaining = [];

  for (const op of queue) {
    try {
      await writeSession(op.docId, op.payload, op.merge);
      flushed += 1;
    } catch (error) {
      remaining.push(op);
    }
  }

  saveQueue(remaining);
  return { flushed, remaining: remaining.length };
}

export function registerOnlineFlushListener() {
  window.addEventListener('online', () => {
    flushQueuedSessionOps().catch((error) => {
      console.warn('Online flush failed.', error);
    });
  });
}

export function createSessionId(playerNumber) {
  const seed = localStorage.getItem('pacmansave_device_id') || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem('pacmansave_device_id', seed);
  return `${seed}-p${playerNumber}-${Date.now()}`;
}

export function getFirestoreHandles() {
  return { db, firestoreApi, PACMAN_COLLECTION };
}

export function formatTimestamp(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}
