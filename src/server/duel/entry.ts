/** Ce que server.js importe du paquet construit par esbuild. */
export { attachDuelServer, DuelServer, randomDeck } from './index.js';
export { MemoryStore, MysqlStore } from './store.js';
export { DuelBot } from './bot.js';
export { STARTER_DECK, CARDS, cardDef } from '../../shared/duel/cards.js';
export { RULES } from '../../shared/duel/engine.js';
export { project } from '../../shared/duel/project.js';
export { createDuel, applyIntent, viewFor, tick } from '../../shared/duel/engine.js';
