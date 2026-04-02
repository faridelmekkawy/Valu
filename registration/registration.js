import { initFirestore, getFirestoreHandles, formatTimestamp } from '/firebaseClient.js';

const sessionsList = document.getElementById('sessionsList');
const statusEl = document.getElementById('registrationStatus');
const template = document.getElementById('sessionTemplate');

function renderSession(docSnap) {
  const data = docSnap.data();
  const node = template.content.firstElementChild.cloneNode(true);
  const summaryBtn = node.querySelector('.session-summary');
  const form = node.querySelector('.session-form');
  const nameInput = node.querySelector('.name-input');
  const phoneInput = node.querySelector('.phone-input');

  nameInput.value = data.name || '';
  phoneInput.value = data.phone || '';

  const wonText = data.won === true ? 'yes' : data.won === false ? 'no' : '—';

  summaryBtn.innerHTML = `
    <div><strong>Player ${data.playerNumber || '—'}</strong> · ${data.status || '—'}</div>
    <div>Name: ${data.name || '—'} · Phone: ${data.phone || '—'}</div>
    <div>Score: ${data.score ?? 0} · Level: ${data.level ?? 1} · Lives: ${data.lives ?? 3} · Won: ${wonText}</div>
    <div>Started: ${formatTimestamp(data.startedAt)} · Ended: ${formatTimestamp(data.endedAt)}</div>
  `;

  summaryBtn.addEventListener('click', () => {
    form.classList.toggle('hidden');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const { db, firestoreApi, PACMAN_COLLECTION } = getFirestoreHandles();

    await firestoreApi.updateDoc(firestoreApi.doc(db, PACMAN_COLLECTION, docSnap.id), {
      name,
      phone
    });

    form.classList.add('hidden');
  });

  return node;
}

async function bootstrap() {
  const fire = await initFirestore();
  if (!fire.ready) {
    if (fire.reason === 'missing-config') {
      statusEl.textContent = 'Firestore config is missing. Set window.__FIREBASE_CONFIG__ or firebase_config in localStorage.';
    } else {
      statusEl.textContent = 'Firestore is unavailable. Check Firebase config/network.';
    }
    return;
  }

  const { db, firestoreApi, PACMAN_COLLECTION } = getFirestoreHandles();

  const q = firestoreApi.query(
    firestoreApi.collection(db, PACMAN_COLLECTION),
    firestoreApi.orderBy('startedAt', 'desc')
  );

  firestoreApi.onSnapshot(q, (snapshot) => {
    sessionsList.innerHTML = '';
    if (snapshot.empty) {
      statusEl.textContent = 'No sessions yet.';
      return;
    }

    statusEl.textContent = `Live sessions: ${snapshot.size}`;

    snapshot.docs.forEach((docSnap) => {
      sessionsList.appendChild(renderSession(docSnap));
    });
  }, (error) => {
    statusEl.textContent = `Live sync error: ${error.message}`;
  });
}

bootstrap();
