import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { project } from '../../shared/duel/project.js';
import type { DuelEvent, Intent, Snapshot } from '../../shared/duel/protocol.js';

export type DuelStatus = 'idle' | 'connecting' | 'queued' | 'playing' | 'over' | 'error';

export interface UseDuel {
  status: DuelStatus;
  snapshot: Snapshot | null;
  /** Derniers événements, pour les animations et le fil du match. */
  feed: { seq: number; event: DuelEvent }[];
  error: { code: string; params?: Record<string, string | number> } | null;
  opponentOnline: boolean;
  queue: () => void;
  cancelQueue: () => void;
  send: (intent: Intent) => void;
}

/**
 * Le client n'est jamais l'autorité : il envoie des intentions et rejoue les
 * événements que le serveur renvoie. Si un numéro de séquence manque, il
 * demande une resynchronisation au lieu de deviner.
 */
export function useDuel(opts: { url?: string; token: string; feedSize?: number }): UseDuel {
  const { url, token, feedSize = 30 } = opts;
  const [status, setStatus] = useState<DuelStatus>('idle');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [feed, setFeed] = useState<{ seq: number; event: DuelEvent }[]>([]);
  const [error, setError] = useState<UseDuel['error']>(null);
  const [opponentOnline, setOpponentOnline] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const snapRef = useRef<Snapshot | null>(null);
  const pending = useRef<{ seq: number; event: DuelEvent }[]>([]);

  const setSnap = useCallback((s: Snapshot | null) => {
    snapRef.current = s;
    setSnapshot(s);
  }, []);

  useEffect(() => {
    if (!token) return;
    setStatus('connecting');
    const socket = io(url ?? '/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    socketRef.current = socket;

    const openWith = (s: Snapshot) => {
      setSnap(s);
      pending.current = [];
      setStatus(s.phase === 'over' ? 'over' : 'playing');
    };

    socket.on('connect', () => {
      const cur = snapRef.current;
      if (cur && cur.phase !== 'over') {
        socket.emit('duel:resync', { duelId: cur.duelId, sinceSeq: cur.seq });
      }
    });

    socket.on('duel:queued', () => setStatus('queued'));
    socket.on('duel:start', openWith);
    socket.on('duel:state', openWith);

    socket.on('duel:event', ({ seq, event }: { duelId: string; seq: number; event: DuelEvent }) => {
      const cur = snapRef.current;
      if (!cur) return;

      if (seq <= cur.seq) return; // doublon après reconnexion
      if (seq > cur.seq + 1) {
        // Trou de séquence : on met de côté et on redemande la suite.
        pending.current.push({ seq, event });
        socket.emit('duel:resync', { duelId: cur.duelId, sinceSeq: cur.seq });
        return;
      }

      let next = project(cur, seq, event);
      const emitted = [{ seq, event }];

      // On applique ce qui attendait derrière le trou.
      pending.current.sort((a, b) => a.seq - b.seq);
      while (pending.current.length && pending.current[0].seq === next.seq + 1) {
        const q = pending.current.shift()!;
        next = project(next, q.seq, q.event);
        emitted.push(q);
      }

      setSnap(next);
      setFeed((f) => [...f, ...emitted].slice(-feedSize));
      if (next.phase === 'over') setStatus('over');
    });

    socket.on('duel:opponent', ({ connected }: { connected: boolean }) => setOpponentOnline(connected));

    socket.on('duel:error', (e: { code: string; params?: Record<string, string | number> }) => {
      setError(e);
      if (e.code === 'error.unauthenticated') setStatus('error');
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, token, feedSize, setSnap]);

  const queue = useCallback(() => socketRef.current?.emit('duel:queue', {}), []);
  const cancelQueue = useCallback(() => socketRef.current?.emit('duel:cancel_queue'), []);
  const send = useCallback((intent: Intent) => {
    const cur = snapRef.current;
    if (!cur) return;
    setError(null);
    socketRef.current?.emit('duel:intent', { duelId: cur.duelId, intent });
  }, []);

  return { status, snapshot, feed, error, opponentOnline, queue, cancelQueue, send };
}
