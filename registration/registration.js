const firebaseConfig = { apiKey: 'REPLACE_ME', authDomain: 'REPLACE_ME', projectId: 'REPLACE_ME' };

const sessionList = document.getElementById('sessionList');
const detailsForm = document.getElementById('detailsForm');
const selectedSessionTitle = document.getElementById('selectedSessionTitle');
const realNameInput = document.getElementById('realName');
const phoneInput = document.getElementById('phone');
const saveStatus = document.getElementById('saveStatus');
const connectionStatus = document.getElementById('connectionStatus');

let db = null;
let fns = null;
let selectedSession = null;

function formatSessionTime(session) {
  if (session.createdAtMs) return new Date(session.createdAtMs).toLocaleString();
  if (session.finishedAtMs) return new Date(session.finishedAtMs).toLocaleString();
  return 'Unknown time';
}

function renderSessions(docs) {
  sessionList.innerHTML = '';
  if (!docs.length) {
    const li = document.createElement('li');
    li.textContent = 'No sessions found yet.';
    sessionList.appendChild(li);
    return;
  }

  docs.forEach((snapshot) => {
    const data = snapshot.data();
    const li = document.createElement('li');
    li.className = 'session-item';
    li.innerHTML = `
      <h3>Player ${data.playerNumber ?? '?'}</h3>
      <p>Status: <strong>${data.status ?? 'unknown'}</strong> | Score: <strong>${data.score ?? 0}</strong></p>
      <p>Name: ${data.realName || '—'} | Phone: ${data.phone || '—'}</p>
      <small>${formatSessionTime(data)}</small>
    `;
    li.addEventListener('click', () => {
      selectedSession = { id: snapshot.id, ...data };
      detailsForm.hidden = false;
      selectedSessionTitle.textContent = `Player ${data.playerNumber ?? '?'} details`;
      realNameInput.value = data.realName || '';
      phoneInput.value = data.phone || '';
      saveStatus.textContent = '';
    });
    sessionList.appendChild(li);
  });
}

async function init() {
  if (Object.values(firebaseConfig).includes('REPLACE_ME')) {
    connectionStatus.textContent = 'Firebase is not configured. Add firebaseConfig values in registration.js and game.js.';
    return;
  }

  try {
    const [{ initializeApp }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);

    const app = initializeApp(firebaseConfig);
    db = firestore.getFirestore(app);
    fns = firestore;
    connectionStatus.textContent = 'Connected. Listening for live session updates...';

    const q = fns.query(
      fns.collection(db, 'sparkie_dash_sessions'),
      fns.orderBy('createdAtMs', 'desc')
    );

    fns.onSnapshot(q, (snapshot) => {
      renderSessions(snapshot.docs);
    }, (error) => {
      connectionStatus.textContent = `Realtime listener error: ${error.message}`;
    });
  } catch (error) {
    connectionStatus.textContent = `Could not connect to Firebase: ${error.message}`;
  }
}

detailsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedSession || !db || !fns) return;

  saveStatus.textContent = 'Saving...';
  try {
    await fns.updateDoc(fns.doc(db, 'sparkie_dash_sessions', selectedSession.id), {
      realName: realNameInput.value.trim(),
      phone: phoneInput.value.trim(),
      updatedAt: fns.serverTimestamp()
    });
    saveStatus.textContent = 'Saved.';
  } catch (error) {
    saveStatus.textContent = `Save failed: ${error.message}`;
  }
});

init();
