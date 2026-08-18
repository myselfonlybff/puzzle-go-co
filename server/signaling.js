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
function roomFor(id) { if (!rooms.has(id)) rooms.set(id, new Set()); return rooms.get(id); }
function broadcast(room, message, except) { room.forEach((peer) => { if (peer !== except) send(peer, message); }); }

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
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.type === 'join') {
      roomId = String(message.session || 'PUZ-7K4M');
      const room = roomFor(roomId);
      if (room.size >= 6) { send(socket, { type: 'full', capacity: 6 }); socket.close(); return; }
      room.add(socket);
      send(socket, { type: 'joined', count: room.size, session: roomId });
      broadcast(room, { type: 'peer-joined', count: room.size }, socket);
      return;
    }
    if (roomId && ['offer', 'answer', 'ice', 'chat'].includes(message.type)) broadcast(roomFor(roomId), message, socket);
  });
  socket.on('close', () => { if (!roomId) return; const room = roomFor(roomId); room.delete(socket); broadcast(room, { type: 'peer-left', count: room.size }); if (!room.size) rooms.delete(roomId); });
});

server.listen(port, () => console.log(`WebRTC Video Puzzle running at http://localhost:${port}`));
