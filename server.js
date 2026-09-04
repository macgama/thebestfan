/**
 * thebestfan.online — point d'entrée.
 *
 * Objectif de cette version : prouver que la chaîne complète fonctionne chez
 * Infomaniak (dépôt, build, démarrage, port, SSL, WebSocket) avant d'y brancher
 * le jeu. Rien d'autre ne doit être ajouté ici tant que /diagnostic n'est pas
 * au vert depuis un téléphone en 4G.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const http = createServer(app);

const io = new Server(http, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingInterval: 20_000,
  pingTimeout: 25_000,
  cors: { origin: process.env.PUBLIC_ORIGIN ?? 'https://thebestfan.online', credentials: true },
});

const started = Date.now();
let sockets = 0;

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    uptime_s: Math.round((Date.now() - started) / 1000),
    sockets,
    db: process.env.DATABASE_URL ? 'configurée' : 'absente',
    origin: process.env.PUBLIC_ORIGIN ?? null,
  });
});

app.get('/', (_req, res) => res.redirect('/diagnostic'));
app.get('/diagnostic', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'diagnostic.html')));

io.on('connection', (socket) => {
  sockets++;
  // Aller-retour minimal : le client mesure la latence et lit le transport utilisé.
  socket.on('ping:client', (t0, ack) => {
    if (typeof ack === 'function') ack({ t0, serverTime: Date.now(), transport: socket.conn.transport.name });
  });
  socket.conn.on('upgrade', (t) => socket.emit('transport', t.name));
  socket.emit('transport', socket.conn.transport.name);
  socket.on('disconnect', () => { sockets--; });
});

const port = Number(process.env.PORT ?? 3000);
http.listen(port, () => console.log(`thebestfan écoute sur ${port}`));

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig} reçu, arrêt propre`);
    io.close();
    http.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
