const state = { pieces: 6, solved: new Set(), camera: true, mic: true, seconds: 0, started: false, sourceUrl: '', sourceName: 'exemple', stream: null, order: [], selectedPiece: null, playerName: '' };
const query = new URLSearchParams(window.location.search);
const sessionId = query.get('session') || 'PUZ-7K4M';
const isGuest = query.has('session');
const sessionUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
const signalUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/signal`;
const board = document.querySelector('#puzzle-board');
const toast = document.querySelector('#toast');
const cameraPreview = document.querySelector('#home-camera-preview');
const photoPreview = document.querySelector('#photo-preview');
const captureCanvas = document.querySelector('#capture-canvas');
const homeScreen = document.querySelector('#home-screen');
const gameScreen = document.querySelector('#game-screen');
const homeImageInput = document.querySelector('#home-image-input');
const homeCameraButton = document.querySelector('#home-camera-button');
let pendingImageUrl = '';
let socket = null;
let isHost = false;
let pendingParticipant = '';
let hostPlayer = 'l’hôte';

function setSource(url, name) {
  if (!url) return false;
  state.sourceUrl = url;
  state.sourceName = name;
  document.querySelector('#source-badge').textContent = `Votre image · ${name}`;
  document.querySelector('#player-display-name').textContent = state.playerName || 'Votre partie';
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
  broadcastGameState();
  if (state.order.every((pieceIndex, position) => pieceIndex === position)) finishGame();
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
  if (state.solved.size === state.pieces) finishGame();
}

function updateProgress() {
  const complete = state.order.reduce((total, pieceIndex, position) => total + (pieceIndex === position ? 1 : 0), 0);
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
    await cameraPreview.play();
    await waitForVideo(cameraPreview);
    state.camera = true;
    document.querySelector('#camera-modal').classList.remove('hidden');
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
  pendingImageUrl = url;
  document.querySelector('#image-confirm-preview').src = url;
  document.querySelector('#camera-modal').classList.add('hidden');
  document.querySelector('#image-modal').classList.remove('hidden');
}

function stopCamera() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  if (cameraPreview) cameraPreview.srcObject = null;
}

function finishGame() {
  const minutes = String(Math.floor(state.seconds / 60)).padStart(2, '0');
  const seconds = String(state.seconds % 60).padStart(2, '0');
  document.querySelector('#finish-stats').textContent = `Temps : ${minutes}:${seconds} · Participants : ${document.querySelector('#player-count').textContent} · Difficulté : ${state.pieces} pièces`;
  document.querySelector('#finish-modal').classList.remove('hidden');
}

function broadcastGameState() {
  if (!socket || socket.readyState !== WebSocket.OPEN || !isHost) return;
  socket.send(JSON.stringify({ type: 'game-state', state: { pieces: state.pieces, order: state.order, sourceUrl: state.sourceUrl, startedAt: state.startedAt || Date.now() } }));
}

function updatePlayers(count) {
  document.querySelector('#player-count').textContent = `${count}/6 joueur${count > 1 ? 's' : ''}`;
  document.querySelector('.player-pill.small').textContent = `${count} / 6`;
  if (count > 1) {
    document.querySelector('#chat-tab').classList.remove('locked');
    document.querySelector('#chat-input').disabled = false;
    document.querySelector('.send-button').disabled = false;
  }
}

function appendChatMessage(message) {
  const empty = document.querySelector('.empty-state');
  if (empty) empty.remove();
  const line = document.createElement('p');
  line.className = 'chat-message';
  line.textContent = `${message.player || 'Joueur'} : ${message.text}`;
  document.querySelector('#tab-chat').insertBefore(line, document.querySelector('.chat-form'));
}

function applyGameState(gameState) {
  state.pieces = gameState.pieces;
  state.order = gameState.order;
  state.sourceUrl = gameState.sourceUrl;
  state.startedAt = gameState.startedAt;
  document.querySelector('#reference-image').src = state.sourceUrl;
  renderPuzzle();
  if (!state.started) startTimer();
}

function connectSession() {
  if (!window.WebSocket || window.location.protocol === 'file:') return;
  socket = new WebSocket(signalUrl);
  socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', session: sessionId, player: state.playerName || 'Joueur' })));
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'joined') { isHost = message.host; hostPlayer = message.hostPlayer || hostPlayer; if (isGuest) { document.querySelector('#home-title').textContent = `Jouer avec ${hostPlayer}`; } updatePlayers(message.count); if (message.pending) showToast('Demande envoyée à l’hôte'); if (message.state) applyGameState(message.state); if (isHost) broadcastGameState(); }
    if (message.type === 'participant-request' && isHost) { pendingParticipant = message.player; document.querySelector('#participant-message').textContent = `${message.player} souhaite rejoindre la partie et le chat.`; document.querySelector('#participant-modal').classList.remove('hidden'); }
    if (message.type === 'peer-joined') { updatePlayers(message.count); showToast(`${message.player || 'Un joueur'} a rejoint la partie`); }
    if (message.type === 'peer-left') updatePlayers(message.count);
    if (message.type === 'accepted' && message.state) applyGameState(message.state);
    if (message.type === 'game-state' && !isHost) applyGameState(message.state);
    if (message.type === 'chat') { appendChatMessage(message); document.querySelector('#chat-tab').classList.add('has-notification'); showToast(`Nouveau message de ${message.player || 'un joueur'}`); }
    if (message.type === 'full') showToast('Salon complet (6/6)');
    if (message.type === 'rejected') showToast('Votre demande a été refusée');
  });
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
  const ready = isGuest ? Boolean(name) : Boolean(name && pendingImageUrl);
  document.querySelector('#start-game').disabled = !ready;
  document.querySelector('#home-summary-name').textContent = name ? `Partie de ${name}` : 'Votre partie solo';
  document.querySelector('#home-summary-detail').textContent = pendingImageUrl ? `${state.pieces} pièces · image prête` : 'Ajoutez une image pour commencer';
}

function configureGuestHome() {
  if (!isGuest) return;
  document.querySelector('#home-eyebrow').textContent = 'Invitation à rejoindre';
  document.querySelector('#home-title').textContent = `Jouer avec ${hostPlayer}`;
  document.querySelector('#home-intro').textContent = 'Entrez votre nom pour demander l’accès à la partie en cours.';
  document.querySelectorAll('.host-only').forEach((element) => { element.hidden = true; });
  document.querySelector('#home-summary-detail').textContent = 'La photo et la difficulté sont définies par l’hôte';
  document.querySelector('#start-game').textContent = 'Jouer avec l’hôte →';
  document.querySelector('#cancel-guest').hidden = false;
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
    const imageCanvas = document.createElement('canvas');
    imageCanvas.width = image.naturalWidth;
    imageCanvas.height = image.naturalHeight;
    imageCanvas.getContext('2d').drawImage(image, 0, 0);
    pendingImageUrl = imageCanvas.toDataURL('image/jpeg', 0.9);
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
  stopCamera();
  updateStartState();
});
document.querySelector('#cancel-camera').addEventListener('click', () => { stopCamera(); document.querySelector('#camera-modal').classList.add('hidden'); });
document.querySelector('#take-camera-photo').addEventListener('click', capturePhoto);
homeCameraButton.addEventListener('click', startCamera);
document.querySelector('#start-game').addEventListener('click', () => {
  state.playerName = document.querySelector('#player-name').value.trim();
  if (isGuest) {
    homeScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    document.querySelector('#game-title').textContent = `Connexion à la partie de ${hostPlayer}`;
    document.querySelector('#source-badge').textContent = 'En attente de l’hôte';
    document.querySelector('.stage-hint').lastElementChild.textContent = 'Votre demande est en attente de validation';
    connectSession();
    return;
  }
  state.order = [];
  setSource(pendingImageUrl, 'galerie');
  homeScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  document.querySelector('#preview-initials').textContent = state.playerName.slice(0, 2).toUpperCase();
  document.querySelector('#player-display-name').textContent = state.playerName;
  document.querySelector('#home-summary-name').textContent = `Partie de ${state.playerName}`;
  renderPuzzle();
  state.startedAt = Date.now();
  startTimer();
  connectSession();
});
document.querySelector('#cancel-guest').addEventListener('click', () => { window.location.href = window.location.pathname; });
configureGuestHome();
renderPuzzle();

document.querySelector('#return-home').addEventListener('click', () => window.location.href = window.location.pathname);
document.querySelector('#continue-chat').addEventListener('click', () => { document.querySelector('#finish-modal').classList.add('hidden'); document.querySelector('[data-tab="chat"]').click(); });
document.querySelector('#accept-participant').addEventListener('click', () => { socket?.send(JSON.stringify({ type: 'participant-response', player: pendingParticipant, accepted: true })); document.querySelector('#participant-modal').classList.add('hidden'); });
document.querySelector('#reject-participant').addEventListener('click', () => { socket?.send(JSON.stringify({ type: 'participant-response', player: pendingParticipant, accepted: false })); document.querySelector('#participant-modal').classList.add('hidden'); });

document.querySelector('#chat-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.querySelector('#chat-input');
  if (!input.value.trim() || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'chat', player: state.playerName || 'Joueur', text: input.value.trim() }));
  appendChatMessage({ player: state.playerName || 'Vous', text: input.value.trim() });
  input.value = '';
});

['#share-header', '#share-main', '#invite-panel', '#invite-player', '#copy-link'].forEach((selector) => document.querySelector(selector).addEventListener('click', (event) => copySessionLink(event.currentTarget)));

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  if (tab.classList.contains('locked')) { showToast('Requis : 2 joueurs minimum'); return; }
  document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
  document.querySelectorAll('.sidebar-content').forEach((panel) => panel.classList.add('hidden'));
  tab.classList.add('active');
  document.querySelector(`#tab-${tab.dataset.tab}`).classList.remove('hidden');
}));

document.querySelector('#leave-session').addEventListener('click', () => document.querySelector('#leave-modal').classList.remove('hidden'));
document.querySelector('#cancel-leave').addEventListener('click', () => document.querySelector('#leave-modal').classList.add('hidden'));
document.querySelector('#confirm-leave').addEventListener('click', () => { window.location.href = window.location.pathname; });
