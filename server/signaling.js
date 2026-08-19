import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const rooms = new Map();
const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

function send(socket, message) { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message)); }
function roomFor(id) { if (!rooms.has(id)) rooms.set(id, { peers: new Set(), host: null, state: null }); return rooms.get(id); }
function broadcast(room, message, except) { room.peers.forEach((peer) => { if (peer !== except) send(peer, message); }); }

const server = createServer(async (request, response) => {
  const requested = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const filePath = normalize(join(root, requested));
  if (!filePath.startsWith(root)) { response.writeHead(403); response.end('Forbidden'); return; }
  try { const body = await readFile(filePath); response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' }); response.end(body); }
  catch { response.writeHead(404); response.end('Not found'); }
});

const websocket = new WebSocketServer({ server, path: '/signal' });
websocket.on('connection', (socket) => {
  let roomId;
  socket.on('message', (raw) => {
      let message = {};
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.type === 'join') {
      roomId = String(message.session || 'PUZ-7K4M');
      const room = roomFor(roomId);
        if (room.peers.size >= 6) { send(socket, { type: 'full', capacity: 6 }); socket.close(); return; }
        socket.player = String(message.player || 'Joueur');
        socket.pending = Boolean(room.host);
        if (!room.host) room.host = socket;
        room.peers.add(socket);
        send(socket, { type: 'joined', count: room.peers.size, session: roomId, host: room.host === socket, pending: socket.pending, state: room.state });
        if (socket.pending) send(room.host, { type: 'participant-request', player: socket.player });
        else broadcast(room, { type: 'peer-joined', count: room.peers.size, player: socket.player }, socket);
      return;
    }
      if (!roomId) return;
      const room = roomFor(roomId);
      if (message.type === 'participant-response' && socket === room.host) {
        const target = [...room.peers].find((peer) => peer.player === message.player && peer.pending);
        if (target) { target.pending = !message.accepted; send(target, { type: message.accepted ? 'accepted' : 'rejected', state: room.state }); if (message.accepted) { broadcast(room, { type: 'peer-joined', count: room.peers.size, player: target.player }, target); } else { room.peers.delete(target); target.close(); } }
        return;
      }
      if (message.type === 'game-state' && socket === room.host) { room.state = message.state; broadcast(room, message, socket); return; }
      if (['offer', 'answer', 'ice', 'chat', 'piece-swap'].includes(message.type)) broadcast(room, message, socket);
  });
    socket.on('close', () => { if (!roomId) return; const room = roomFor(roomId); if (!room) return; room.peers.delete(socket); if (room.host === socket) room.host = room.peers.values().next().value || null; broadcast(room, { type: 'peer-left', count: room.peers.size }); if (!room.peers.size) rooms.delete(roomId); });
});

server.listen(port, () => console.log(`WebRTC Video Puzzle running at http://localhost:${port}`));
