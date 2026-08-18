const state = { pieces: 6, solved: new Set(), camera: true, mic: true, seconds: 0, started: false, sourceUrl: '', sourceName: 'exemple', stream: null, order: [], selectedPiece: null, playerName: '' };
const sessionId = new URLSearchParams(window.location.search).get('session') || 'PUZ-7K4M';
const sessionUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
const board = document.querySelector('#puzzle-board');
const toast = document.querySelector('#toast');
const cameraPreview = document.querySelector('#camera-preview');
const photoPreview = document.querySelector('#photo-preview');
const captureCanvas = document.querySelector('#capture-canvas');
const homeScreen = document.querySelector('#home-screen');
const gameScreen = document.querySelector('#game-screen');
const homeImageInput = document.querySelector('#home-image-input');
let pendingImageUrl = '';

function setSource(url, name) {
  if (!url) return false;
  state.sourceUrl = url;
  state.sourceName = name;
  document.querySelector('#source-badge').textContent = `Votre image · ${name}`;
  document.querySelector('#source-note').textContent = `${name} est prête : chaque pièce reprend sa partie de l'image.`;
  document.querySelector('#reference-image').src = url;
  renderPuzzle();
  return true;
}

function shuffleOrder() {
  state.order = Array.from({ length: state.pieces }, (_, index) => index);
  for (let index = state.order.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [state.order[index], state.order[randomIndex]] = [state.order[randomIndex], state.order[index]];
  }
}

function renderPuzzle() {
  if (state.order.length !== state.pieces) shuffleOrder();
  board.className = `puzzle-board grid-${state.pieces}`;
  board.innerHTML = '';
  state.solved.clear();
  for (let index = 0; index < state.pieces; index += 1) {
    const sourceIndex = state.order[index];
    const piece = document.createElement('button');
    piece.className = 'puzzle-piece';
    piece.type = 'button';
    piece.dataset.index = sourceIndex;
    piece.textContent = String(sourceIndex + 1).padStart(2, '0');
    piece.setAttribute('aria-label', `Pièce ${sourceIndex + 1}`);
    if (state.sourceUrl) {
      const columns = state.pieces === 6 || state.pieces === 9 ? 3 : 4;
      const rows = Math.ceil(state.pieces / columns);
      const column = sourceIndex % columns;
      const row = Math.floor(sourceIndex / columns);
      piece.style.backgroundImage = `url(${JSON.stringify(state.sourceUrl)})`;
      piece.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
      piece.style.backgroundPosition = `${columns === 1 ? 0 : (column / (columns - 1)) * 100}% ${rows === 1 ? 0 : (row / (rows - 1)) * 100}%`;
      piece.style.backgroundRepeat = 'no-repeat';
      piece.style.backgroundColor = '#1e293b';
      piece.classList.add('image-piece');
    }
    piece.addEventListener('click', () => selectPiece(piece));
    board.appendChild(piece);
  }
  updateProgress();
}

function selectPiece(piece) {
  if (state.selectedPiece === piece) {
    piece.classList.remove('selected-piece');
    state.selectedPiece = null;
    return;
  }
  if (!state.selectedPiece) {
    state.selectedPiece = piece;
    piece.classList.add('selected-piece');
    showToast('Sélectionnez une seconde pièce pour échanger');
    return;
  }
  const first = state.selectedPiece;
  const firstIndex = Number(first.dataset.index);
  const secondIndex = Number(piece.dataset.index);
  const firstPosition = state.order.indexOf(firstIndex);
  const secondPosition = state.order.indexOf(secondIndex);
  [state.order[firstPosition], state.order[secondPosition]] = [state.order[secondPosition], state.order[firstPosition]];
  state.selectedPiece = null;
  renderPuzzle();
  showToast('Pièces échangées');
}

function lockPiece(piece) {
  const index = Number(piece.dataset.index);
  if (state.solved.has(index)) return;
  state.solved.add(index);
  piece.classList.add('locked');
  piece.textContent = '✓';
  startTimer();
  updateProgress();
  if (state.solved.size === state.pieces) showToast('Puzzle complété !');
}

function updateProgress() {
  const complete = state.solved.size;
  document.querySelector('#progress-label').textContent = `${complete} / ${state.pieces} pièces`;
  document.querySelector('#progress-bar').style.width = `${(complete / state.pieces) * 100}%`;
}

function startTimer() {
  if (state.started) return;
  state.started = true;
  window.setInterval(() => {
    state.seconds += 1;
    const minutes = String(Math.floor(state.seconds / 60)).padStart(2, '0');
    const seconds = String(state.seconds % 60).padStart(2, '0');
    document.querySelector('#timer').textContent = `${minutes}:${seconds}`;
  }, 1000);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { showToast('Caméra indisponible : utilisez HTTPS ou localhost'); return; }
  try {
    if (!state.stream) state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
    cameraPreview.srcObject = state.stream;
    cameraPreview.hidden = false;
    photoPreview.hidden = true;
    await waitForVideo(cameraPreview);
    state.camera = true;
    document.querySelector('#camera-toggle').classList.remove('off');
    document.querySelector('#source-note').textContent = 'Caméra active. Prenez une photo pour figer votre visage en puzzle.';
    const initialFrame = captureVideoFrame();
    if (initialFrame) setSource(initialFrame, 'caméra');
    showToast('Caméra activée');
  } catch { showToast('Accès caméra refusé ou indisponible'); }
}

function captureVideoFrame() {
  if (!cameraPreview.videoWidth || !cameraPreview.videoHeight) return '';
  captureCanvas.width = cameraPreview.videoWidth;
  captureCanvas.height = cameraPreview.videoHeight;
  captureCanvas.getContext('2d').drawImage(cameraPreview, 0, 0);
  return captureCanvas.toDataURL('image/jpeg', 0.86);
}

function waitForVideo(video) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => { video.removeEventListener('loadedmetadata', finish); video.removeEventListener('canplay', finish); resolve(); };
    video.addEventListener('loadedmetadata', finish, { once: true });
    video.addEventListener('canplay', finish, { once: true });
  });
}

async function capturePhoto() {
  if (!state.stream) { showToast('Activez d’abord la caméra'); return; }
  await waitForVideo(cameraPreview);
  const url = captureVideoFrame();
  if (!url) { showToast('La caméra n’est pas encore prête'); return; }
  cameraPreview.hidden = true;
  photoPreview.hidden = false;
  photoPreview.src = url;
  setSource(url, 'photo');
  showToast('Photo capturée : puzzle prêt');
}

function loadGalleryImage(file) {
  if (!file) return;
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.addEventListener('load', () => {
    cameraPreview.hidden = true;
    photoPreview.hidden = false;
    photoPreview.src = imageUrl;
    if (setSource(imageUrl, 'galerie')) showToast('Image importée : puzzle prêt');
  });
  image.addEventListener('error', () => { URL.revokeObjectURL(imageUrl); showToast('Cette image ne peut pas être utilisée'); }, { once: true });
  image.src = imageUrl;
}

async function copySessionLink(button) {
  try { await navigator.clipboard.writeText(sessionUrl); } catch { window.prompt('Copiez le lien de la session :', sessionUrl); }
  const original = button.innerHTML;
  button.innerHTML = '✓ Lien copié !';
  button.style.background = 'var(--green)';
  showToast('Lien de session copié');
  window.setTimeout(() => { button.innerHTML = original; button.style.background = ''; }, 2000);
}

document.querySelector('#session-id').textContent = sessionId;
document.querySelector('#share-url').textContent = sessionUrl;
document.querySelector('#reference-image').src = state.sourceUrl;

function updateStartState() {
  const name = document.querySelector('#player-name').value.trim();
  const ready = Boolean(name && pendingImageUrl);
  document.querySelector('#start-game').disabled = !ready;
  document.querySelector('#home-summary-name').textContent = name ? `Partie de ${name}` : 'Votre partie solo';
  document.querySelector('#home-summary-detail').textContent = pendingImageUrl ? `${state.pieces} pièces · image prête` : 'Ajoutez une image pour commencer';
}

document.querySelector('#player-name').addEventListener('input', updateStartState);
document.querySelectorAll('.difficulty-option').forEach((option) => option.addEventListener('click', () => {
  document.querySelectorAll('.difficulty-option').forEach((item) => item.classList.remove('selected'));
  option.classList.add('selected');
  state.pieces = Number(option.dataset.pieces);
  updateStartState();
}));
document.querySelector('#home-image-button').addEventListener('click', () => homeImageInput.click());
homeImageInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.addEventListener('load', () => {
    pendingImageUrl = url;
    document.querySelector('#image-confirm-preview').src = url;
    document.querySelector('#home-image-label').textContent = file.name;
    document.querySelector('#image-modal').classList.remove('hidden');
  }, { once: true });
  image.src = url;
});
document.querySelector('#cancel-image').addEventListener('click', () => {
  if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
  pendingImageUrl = '';
  document.querySelector('#image-modal').classList.add('hidden');
  updateStartState();
});
document.querySelector('#confirm-image').addEventListener('click', () => {
  const preview = document.querySelector('#home-image-preview');
  preview.classList.remove('placeholder');
  preview.style.backgroundImage = `url(${JSON.stringify(pendingImageUrl)})`;
  preview.textContent = '';
  document.querySelector('#image-modal').classList.add('hidden');
  updateStartState();
});
document.querySelector('#start-game').addEventListener('click', () => {
  state.playerName = document.querySelector('#player-name').value.trim();
  state.order = [];
  setSource(pendingImageUrl, 'galerie');
  homeScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  document.querySelector('#preview-initials').textContent = state.playerName.slice(0, 2).toUpperCase();
  document.querySelector('#home-summary-name').textContent = `Partie de ${state.playerName}`;
  renderPuzzle();
  startTimer();
});
renderPuzzle();

document.querySelector('#start-camera').addEventListener('click', startCamera);
document.querySelector('#capture-photo').addEventListener('click', capturePhoto);
document.querySelector('#choose-image')?.addEventListener('click', () => document.querySelector('#image-input').click());
document.querySelector('#image-input').addEventListener('change', (event) => loadGalleryImage(event.target.files[0]));

document.querySelectorAll('.grid-option').forEach((option) => option.addEventListener('click', () => {
  document.querySelectorAll('.grid-option').forEach((item) => item.classList.remove('selected'));
  option.classList.add('selected');
  state.pieces = Number(option.dataset.pieces);
  state.order = [];
  renderPuzzle();
}));

['#share-header', '#share-main', '#invite-panel', '#invite-player', '#copy-link'].forEach((selector) => document.querySelector(selector).addEventListener('click', (event) => copySessionLink(event.currentTarget)));

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  if (tab.classList.contains('locked')) { showToast('Requis : 2 joueurs minimum'); return; }
  document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
  document.querySelectorAll('.sidebar-content').forEach((panel) => panel.classList.add('hidden'));
  tab.classList.add('active');
  document.querySelector(`#tab-${tab.dataset.tab}`).classList.remove('hidden');
}));

document.querySelector('#camera-toggle').addEventListener('click', (event) => { state.camera = !state.camera; event.currentTarget.classList.toggle('off', !state.camera); document.querySelector('#media-state').textContent = `${state.camera ? 'Caméra' : 'Caméra coupée'} et ${state.mic ? 'micro actifs' : 'micro coupé'}`; });
document.querySelector('#mic-toggle').addEventListener('click', (event) => { state.mic = !state.mic; event.currentTarget.classList.toggle('off', !state.mic); document.querySelector('#media-state').textContent = `${state.camera ? 'Caméra' : 'Caméra coupée'} et ${state.mic ? 'micro actifs' : 'micro coupé'}`; });

document.querySelector('#leave-session').addEventListener('click', () => document.querySelector('#leave-modal').classList.remove('hidden'));
document.querySelector('#cancel-leave').addEventListener('click', () => document.querySelector('#leave-modal').classList.add('hidden'));
document.querySelector('#confirm-leave').addEventListener('click', () => { window.location.href = window.location.pathname; });
