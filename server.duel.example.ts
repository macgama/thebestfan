/**
 * À fusionner dans le server.ts existant de FANZDuel.
 * Le duel n'impose rien d'autre : ni base, ni framework, ni Firestore.
 */
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { attachDuelServer, randomDeck } from './src/server/duel/index.js';
import { MemoryStore, MysqlStore, type DuelStore } from './src/server/duel/store.js';

const app = express();
const http = createServer(app);

// Infomaniak termine le TLS devant l'application : websocket + repli polling.
const io = new Server(http, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingInterval: 20_000,
  pingTimeout: 25_000,
  cors: { origin: process.env.PUBLIC_ORIGIN ?? 'https://thebestfan.online', credentials: true },
});

const store: DuelStore = process.env.DATABASE_URL
  ? await MysqlStore.create(process.env.DATABASE_URL)
  : new MemoryStore();

const duels = attachDuelServer(io, {
  store,

  /**
   * Remplace ce bloc par ta vérification de session réelle.
   * Tant que c'est le jeton brut qui fait foi, n'importe qui peut se faire
   * passer pour n'importe qui : à faire avant toute mise en ligne publique.
   */
  authenticate: async (token) => {
    if (!token) return null;
    // Exemple avec Firebase Admin, déjà présent dans le dépôt :
    // const decoded = await getAuth().verifyIdToken(token);
    // return { userId: decoded.uid, name: decoded.name ?? 'FANZ' };
    return { userId: token, name: token.slice(0, 12) };
  },

  /** Deck sauvegardé du joueur : 20 cartes qu'il possède réellement. */
  getDeck: async (userId, deckId) => {
    // const rows = await db.query('SELECT card_id FROM deck_cards WHERE user_id = ? AND deck_id = ?', [userId, deckId]);
    // return rows.map(r => r.card_id);
    void userId; void deckId;
    return randomDeck();
  },
});

/**
 * Worker API-Football (7 500 requêtes/jour = une interrogation toutes les
 * ~12 s en continu, largement suffisant si un seul worker interroge et que
 * tous les duels lisent le résultat).
 * Quand un but tombe, on l'injecte dans les duels des joueurs qui suivent ce club.
 */
export async function onFootballGoal(teamId: number, teamName: string, fixtureId: number, minute: number) {
  // const fans = await db.query('SELECT user_id FROM user_follows WHERE team_id = ?', [teamId]);
  const fans: { user_id: string }[] = [];
  for (const f of fans) {
    await duels.liveGoal(f.user_id, fixtureId, teamName, minute);
  }
}

app.get('/healthz', (_req, res) => res.json({ ok: true, ...duels.stats }));

// Infomaniak fournit le port dans PORT.
const port = Number(process.env.PORT ?? 3000);
http.listen(port, () => console.log(`FANZDuel écoute sur ${port}`));
