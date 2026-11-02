// Fusion de deux versions des données (téléphone ↔ serveur) sans perdre d'opération.
import type { State, Tx } from './engine';

const txStamp = (t: Tx) => t.history?.length ? t.history[t.history.length - 1].at : t.createdAt ?? '';

export function mergeStates(local: State, remote: State): State {
  const deleted = new Set([...(local.deletedTxIds ?? []), ...(remote.deletedTxIds ?? [])]);
  const byId = new Map<string, Tx>();
  for (const t of [...remote.txs, ...local.txs]) {
    if (deleted.has(t.id)) continue;
    const prev = byId.get(t.id);
    // Même opération des deux côtés : on garde la version modifiée le plus récemment.
    if (!prev || txStamp(t) >= txStamp(prev)) byId.set(t.id, t);
  }
  const localNewer = (local.updatedAt ?? '') >= (remote.updatedAt ?? '');
  const base = localNewer ? local : remote;
  return {
    ...base,
    txs: [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
    deletedTxIds: [...deleted].slice(-3000),
    updatedAt: localNewer ? local.updatedAt : remote.updatedAt,
  };
}

export const hasData = (s: State) => s.txs.length > 0 || s.settings.expectedIncome > 0;
