// Pure Wizard game logic – no DOM, no Vue. Used by app.js and the node tests.

export const GAME_VERSION = 3;

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

export const clampRounds = (rounds, playerCount) =>
  Math.min(Math.max(1, Math.floor(rounds) || totalRoundsFor(playerCount)), totalRoundsFor(playerCount));

export const createGame = ({
  players, noEvenBids = true, bomb = true, cloud = true, totalRounds,
  startRound = 1, dealerIndex, startScores = {}, now = Date.now()
}) => ({
  version: GAME_VERSION,
  id: String(now),
  timestamp: now,
  players: [...players],
  totalRounds: clampRounds(totalRounds, players.length),
  state: 'bidding', // 'bidding' | 'playing' | 'finished'
  settings: { noEvenBids, bomb, cloud },
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

export const scoreRound = (round, players) => {
  round.scores = Object.fromEntries(players.map(p => [p, roundScore(round.bids[p], round.tricks[p])]));
};

// Recalculates an already scored round after its bids or tricks were corrected.
export const rescoreRound = (game, roundNum) => {
  const round = game.rounds.find(r => r.roundNum === roundNum && r.scores);
  if (!round) return false;
  scoreRound(round, game.players);
  return true;
};

// Scores the current round and either finishes the game or starts the next round.
export const completeRound = game => {
  const round = currentRound(game);
  scoreRound(round, game.players);
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

// Running totals after every scored round; the first point holds the start scores.
export const scoreHistory = game => {
  const scored = game.rounds.filter(r => r.scores);
  const running = { ...game.startScores };
  const points = [{ roundNum: (scored.length ? scored[0].roundNum : 1) - 1, totals: { ...running } }];
  scored.forEach(r => {
    game.players.forEach(p => { running[p] += r.scores[p]; });
    points.push({ roundNum: r.roundNum, totals: { ...running } });
  });
  return points;
};

export const playerStats = game => {
  const scored = game.rounds.filter(r => r.scores);
  return Object.fromEntries(game.players.map(p => {
    let hits = 0;
    let streak = 0;
    let longestStreak = 0;
    let deviation = 0;
    scored.forEach(r => {
      const hit = r.bids[p] === r.tricks[p];
      hits += hit ? 1 : 0;
      streak = hit ? streak + 1 : 0;
      longestStreak = Math.max(longestStreak, streak);
      deviation += Math.abs(r.bids[p] - r.tricks[p]);
    });
    const scores = scored.map(r => r.scores[p]);
    const rounds = scored.length;
    return [p, {
      rounds,
      hits,
      hitRate: rounds ? hits / rounds : 0,
      bestRound: rounds ? Math.max(...scores) : 0,
      worstRound: rounds ? Math.min(...scores) : 0,
      longestStreak,
      avgDeviation: rounds ? deviation / rounds : 0
    }];
  }));
};

// End-of-game titles; ties list every player sharing the value.
export const awards = stats => {
  const players = Object.keys(stats);
  if (!players.length || !stats[players[0]].rounds) return [];
  const leaders = (key, pick) => {
    const value = pick(...players.map(p => stats[p][key]));
    return { value, players: players.filter(p => stats[p][key] === value) };
  };
  return [
    { id: 'hitRate', ...leaders('hitRate', Math.max) },
    { id: 'longestStreak', ...leaders('longestStreak', Math.max) },
    { id: 'bestRound', ...leaders('bestRound', Math.max) },
    { id: 'worstRound', ...leaders('worstRound', Math.min) }
  ]
    .filter(a => (a.id === 'worstRound' ? a.value < 0 : a.value > 0))
    // A title shared by everyone says nothing.
    .filter(a => a.players.length < players.length);
};

// Per player name across all finished games; a shared first place counts as a win.
export const allTimeStats = games => {
  const byName = {};
  const records = { highScore: null, bestRound: null, longestStreak: null };
  const beat = (key, value, player, timestamp) => {
    if (!records[key] || value > records[key].value) records[key] = { value, player, timestamp };
  };

  games.filter(g => g.state === 'finished').forEach(g => {
    const finalTotals = totals(g);
    const top = Math.max(...Object.values(finalTotals));
    const stats = playerStats(g);
    g.players.forEach(p => {
      const entry = byName[p] || (byName[p] = { player: p, games: 0, wins: 0, points: 0, best: -Infinity, hits: 0, rounds: 0 });
      entry.games++;
      entry.wins += finalTotals[p] === top ? 1 : 0;
      entry.points += finalTotals[p];
      entry.best = Math.max(entry.best, finalTotals[p]);
      entry.hits += stats[p].hits;
      entry.rounds += stats[p].rounds;
      beat('highScore', finalTotals[p], p, g.timestamp);
      if (stats[p].rounds) beat('bestRound', stats[p].bestRound, p, g.timestamp);
      beat('longestStreak', stats[p].longestStreak, p, g.timestamp);
    });
  });

  const players = Object.values(byName)
    .map(e => ({
      player: e.player,
      games: e.games,
      wins: e.wins,
      winRate: e.wins / e.games,
      avgPoints: Math.round(e.points / e.games),
      best: e.best,
      hitRate: e.rounds ? e.hits / e.rounds : 0
    }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.avgPoints - a.avgPoints);
  return { players, records };
};

// Names from earlier games, most frequent first, then most recent.
export const knownPlayers = games => {
  const seen = {};
  games.forEach(g => g.players.forEach(p => {
    const entry = seen[p] || (seen[p] = { count: 0, last: 0 });
    entry.count++;
    entry.last = Math.max(entry.last, g.timestamp);
  }));
  return Object.keys(seen).sort((a, b) => seen[b].count - seen[a].count || seen[b].last - seen[a].last);
};

// Brings saved games of older app versions up to the current format.
export const migrateGame = game => {
  if (game.version >= GAME_VERSION) return game;
  const v2 = game.version >= 2 ? game : migrateV1(game);
  // v3: special cards can be switched off; older games always had both.
  return { ...v2, version: GAME_VERSION, settings: { bomb: true, cloud: true, ...v2.settings } };
};

// v1 stored totalScores, sparse rounds and the states 'archived'/'cloud'.
const migrateV1 = game => {
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
    version: 2,
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
