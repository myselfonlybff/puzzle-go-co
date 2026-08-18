# Signaling WebRTC

Le serveur relaie uniquement les messages de signalisation initiaux (`offer`, `answer`, `ice`) et les messages de chat vers les autres connexions du même `session`. Les flux média restent pair-à-pair via WebRTC.

```bash
npm install
npm start
```

Le serveur sert aussi le frontend sur `http://localhost:4173` et expose le WebSocket sur `/signal`. La limite de chaque salon est strictement de 6 connexions.
