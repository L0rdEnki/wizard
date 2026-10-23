// Pure Wizard game logic – no DOM, no Vue. Used by app.js and the node tests.

export const GAME_VERSION = 2;

const mod = (n, m) => ((n % m) + m) % m;
const sum = values => values.reduce((a, b) => a + (b || 0), 0);

export const totalRoundsFor = playerCount => Math.floor(60 / playerCount);

// 20 points for a correct bid plus 10 per trick, otherwise -10 per trick difference.
export const roundScore = (bid, tricks) =>
  bid === tricks ? 20 + tricks * 10 : -Math.abs(bid - tricks) * 10;

// Players in bidding/playing order: the player left of the dealer starts.
export const biddingOrder = (players, dealerIndex) =>
  players.map((_, i) => players[mod(dealerIndex + 1 + i, players.length)]);

// "Tipps dürfen nicht aufgehen": the last bidder may not make the bids add up to the card count.
// Returns { player, value } or null when no value is forbidden.
export const forbiddenBid = (bids, order, numCards) => {
  if (order.length === 0) return null;
  const last = order[order.length - 1];
  const value = numCards - sum(order.slice(0, -1).map(p => bids[p]));
  return value >= 0 && value <= numCards ? { player: last, value } : null;
};

export const expectedTricks = round => round.roundNum - (round.bombPlayed ? 1 : 0);

export const newRound = (roundNum, dealerIndex, players) => ({
  roundNum,
  dealerIndex,
  bids: Object.fromEntries(players.map(p => [p, 0])),
  tricks: Object.fromEntries(players.map(p => [p, 0])),
  bombPlayed: false,
  cloudUsedBy: null
});

export const currentRound = game => game.rounds[game.rounds.length - 1];

export const createGame = ({ players, noEvenBids = true, startRound = 1, dealerIndex, startScores = {}, now = Date.now() }) => ({
  version: GAME_VERSION,
  id: String(now),
  timestamp: now,
  players: [...players],
  totalRounds: totalRoundsFor(players.length),
  state: 'bidding', // 'bidding' | 'playing' | 'finished'
  settings: { noEvenBids },
  startScores: Object.fromEntries(players.map(p => [p, Number(startScores[p]) || 0])),
  rounds: [newRound(startRound, dealerIndex, players)]
});

export const totals = game => Object.fromEntries(game.players.map(p => [
  p,
  (game.startScores[p] || 0) + sum(game.rounds.map(r => r.scores ? r.scores[p] : 0))
]));

// Sorted descending; equal totals share a rank.
export const rankings = (players, totalsByPlayer) => players
  .map(player => ({ player, total: totalsByPlayer[player] }))
  .sort((a, b) => b.total - a.total)
  .map((entry, _, all) => ({ ...entry, rank: 1 + all.filter(o => o.total > entry.total).length }));

// Scores the current round and either finishes the game or starts the next round.
export const completeRound = game => {
  const round = currentRound(game);
  round.scores = Object.fromEntries(game.players.map(p => [p, roundScore(round.bids[p], round.tricks[p])]));
  if (round.roundNum >= game.totalRounds) {
    game.state = 'finished';
  } else {
    game.rounds.push(newRound(round.roundNum + 1, mod(round.dealerIndex + 1, game.players.length), game.players));
    game.state = 'bidding';
  }
  return game.state;
};

// Undoes completeRound: drops the untouched next round and reopens the scored one.
export const canReopen = game => {
  const scored = game.state === 'finished' ? currentRound(game) : game.rounds[game.rounds.length - 2];
  return game.state !== 'playing' && Boolean(scored && scored.scores);
};

export const reopenLastRound = game => {
  if (!canReopen(game)) return false;
  if (game.state !== 'finished') game.rounds.pop();
  delete currentRound(game).scores;
  game.state = 'playing';
  return true;
};

// Converts games saved by the first app version (totalScores, sparse rounds, state 'archived'/'cloud').
export const migrateGame = game => {
  if (game.version >= GAME_VERSION) return game;
  const n = game.players.length;
  const rounds = (game.rounds || []).filter(Boolean).map(r => ({
    cloudUsedBy: null,
    ...r,
    tricks: { ...r.tricks },
    dealerIndex: r.dealerIndex ?? mod(game.dealerIndex - (game.currentRound - r.roundNum), n)
  }));
  const startScores = Object.fromEntries(game.players.map(p => [
    p,
    ((game.totalScores || {})[p] || 0) - sum(rounds.map(r => r.scores ? r.scores[p] : 0))
  ]));
  const state = { archived: 'finished', cloud: 'playing' }[game.state] || game.state;
  if (state !== 'finished' && rounds.length) {
    const round = rounds[rounds.length - 1];
    game.players.forEach(p => { round.tricks[p] = round.tricks[p] || 0; });
  }
  return {
    version: GAME_VERSION,
    id: game.id,
    timestamp: game.timestamp,
    players: game.players,
    totalRounds: game.totalRounds || totalRoundsFor(n),
    state,
    settings: { noEvenBids: false },
    startScores,
    rounds: rounds.length ? rounds : [newRound(game.currentRound || 1, game.dealerIndex || 0, game.players)]
  };
};
