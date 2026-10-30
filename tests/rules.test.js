import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundScore, maxBid, biddingOrder, forbiddenBid, expectedTricks, createGame, currentRound,
  totals, rankings, completeRound, canReopen, reopenLastRound, migrateGame,
  rescoreRound, scoreHistory, playerStats, awards, allTimeStats, knownPlayers
} from '../js/rules.js';

const players = ['Anna', 'Ben', 'Cleo'];

test('roundScore', () => {
  assert.equal(roundScore(0, 0), 20);
  assert.equal(roundScore(3, 3), 50);
  assert.equal(roundScore(2, 0), -20);
  assert.equal(roundScore(0, 3), -30);
});

test('maxBid allows one bid above the card count', () => {
  assert.equal(maxBid(3), 4);
  assert.equal(roundScore(4, 3), -10);
});

test('biddingOrder starts left of the dealer', () => {
  assert.deepEqual(biddingOrder(players, 0), ['Ben', 'Cleo', 'Anna']);
  assert.deepEqual(biddingOrder(players, 2), ['Anna', 'Ben', 'Cleo']);
});

test('forbiddenBid', () => {
  const order = ['Ben', 'Cleo', 'Anna'];
  assert.deepEqual(forbiddenBid({ Ben: 1, Cleo: 1, Anna: 0 }, order, 3), { player: 'Anna', value: 1 });
  assert.deepEqual(forbiddenBid({ Ben: 0, Cleo: 0, Anna: 0 }, order, 1), { player: 'Anna', value: 1 });
  assert.deepEqual(forbiddenBid({ Ben: 2, Cleo: 1, Anna: 0 }, order, 3), { player: 'Anna', value: 0 });
  assert.equal(forbiddenBid({ Ben: 3, Cleo: 1, Anna: 0 }, order, 3), null);
});

test('expectedTricks respects the bomb', () => {
  assert.equal(expectedTricks({ roundNum: 4, bombPlayed: false }), 4);
  assert.equal(expectedTricks({ roundNum: 4, bombPlayed: true }), 3);
});

test('game flow, totals, rankings and reopening', () => {
  const game = createGame({ players, dealerIndex: 0, startScores: { Anna: 30 }, now: 1 });
  assert.equal(game.totalRounds, 20);
  Object.assign(currentRound(game).bids, { Ben: 1, Cleo: 0, Anna: 0 });
  Object.assign(currentRound(game).tricks, { Ben: 1, Cleo: 0, Anna: 0 });
  game.state = 'playing';
  assert.equal(completeRound(game), 'bidding');
  assert.deepEqual(totals(game), { Anna: 50, Ben: 30, Cleo: 20 });
  assert.equal(currentRound(game).roundNum, 2);
  assert.equal(currentRound(game).dealerIndex, 1);
  assert.deepEqual(rankings(players, { Anna: 10, Ben: 30, Cleo: 10 }).map(r => [r.player, r.rank]),
    [['Ben', 1], ['Anna', 2], ['Cleo', 2]]);

  assert.ok(canReopen(game));
  assert.ok(reopenLastRound(game));
  assert.equal(game.rounds.length, 1);
  assert.equal(game.state, 'playing');
  assert.deepEqual(totals(game), { Anna: 30, Ben: 0, Cleo: 0 });
  assert.equal(canReopen(game), false);
});

test('last round finishes the game and can be reopened', () => {
  const game = createGame({ players, dealerIndex: 1, startRound: 20, now: 1 });
  game.state = 'playing';
  assert.equal(completeRound(game), 'finished');
  assert.equal(game.rounds.length, 1);
  assert.ok(reopenLastRound(game));
  assert.equal(game.state, 'playing');
});

test('migrateGame converts the v1 format', () => {
  const old = {
    id: '1', name: 'Spiel', timestamp: 1, players, totalRounds: 20,
    currentRound: 4, dealerIndex: 0, state: 'cloud',
    rounds: [null, null,
      { roundNum: 3, bids: { Anna: 1, Ben: 1, Cleo: 0 }, tricks: { Anna: 1, Ben: 2, Cleo: 0 }, bombPlayed: false,
        scores: { Anna: 30, Ben: -10, Cleo: 20 } },
      { roundNum: 4, bids: { Anna: 0, Ben: 0, Cleo: 0 }, tricks: {}, bombPlayed: false }],
    totalScores: { Anna: 130, Ben: -10, Cleo: 60 }
  };
  const game = migrateGame(old);
  assert.equal(game.version, 3);
  assert.deepEqual(game.settings, { noEvenBids: false, bomb: true, cloud: true });
  assert.equal(game.state, 'playing');
  assert.equal(game.rounds.length, 2);
  assert.deepEqual(game.startScores, { Anna: 100, Ben: 0, Cleo: 40 });
  assert.deepEqual(totals(game), old.totalScores);
  assert.equal(game.rounds[0].dealerIndex, 2);
  assert.equal(game.rounds[1].dealerIndex, 0);
  assert.deepEqual(game.rounds[1].tricks, { Anna: 0, Ben: 0, Cleo: 0 });
  assert.equal(migrateGame(game), game);
  assert.equal(migrateGame({ ...old, state: 'archived' }).state, 'finished');
});

test('migrateGame adds special card settings to v2 games', () => {
  const v2 = { ...createGame({ players, dealerIndex: 0, now: 1 }), version: 2, settings: { noEvenBids: true } };
  assert.deepEqual(migrateGame(v2).settings, { noEvenBids: true, bomb: true, cloud: true });
});

test('createGame options', () => {
  const game = createGame({ players, dealerIndex: 0, totalRounds: 5, cloud: false, now: 1 });
  assert.equal(game.totalRounds, 5);
  assert.deepEqual(game.settings, { noEvenBids: true, bomb: true, cloud: false });
  assert.equal(createGame({ players, dealerIndex: 0, totalRounds: 99 }).totalRounds, 20);
  assert.equal(createGame({ players, dealerIndex: 0, totalRounds: 0 }).totalRounds, 20);
});

// Plays rounds with the given [bids, tricks] per player (in `players` order).
const playGame = (rounds, opts = {}) => {
  const game = createGame({ players, dealerIndex: 0, totalRounds: rounds.length, now: 1, ...opts });
  rounds.forEach(results => {
    const round = currentRound(game);
    players.forEach((p, i) => { [round.bids[p], round.tricks[p]] = results[i]; });
    completeRound(game);
  });
  return game;
};

test('rescoreRound corrects an earlier round', () => {
  const game = playGame([[[0, 0], [1, 1], [0, 0]], [[1, 1], [1, 0], [0, 1]]]);
  assert.deepEqual(totals(game), { Anna: 50, Ben: 20, Cleo: 10 });
  game.rounds[0].tricks.Ben = 0;
  game.rounds[0].tricks.Anna = 1;
  assert.ok(rescoreRound(game, 1));
  assert.deepEqual(totals(game), { Anna: 20, Ben: -20, Cleo: 10 });
  assert.equal(rescoreRound(game, 7), false);
});

test('scoreHistory, playerStats and awards', () => {
  const game = playGame([[[0, 0], [1, 1], [0, 0]], [[1, 1], [1, 0], [0, 1]], [[0, 0], [2, 3], [1, 0]]],
    { startScores: { Cleo: 10 } });
  assert.deepEqual(scoreHistory(game).map(h => [h.roundNum, h.totals.Anna, h.totals.Ben, h.totals.Cleo]),
    [[0, 0, 0, 10], [1, 20, 30, 30], [2, 50, 20, 20], [3, 70, 10, 10]]);
  const stats = playerStats(game);
  assert.deepEqual(stats.Anna, { rounds: 3, hits: 3, hitRate: 1, bestRound: 30, worstRound: 20, longestStreak: 3, avgDeviation: 0 });
  assert.equal(stats.Ben.longestStreak, 1);
  assert.equal(stats.Ben.worstRound, -10);
  const byId = Object.fromEntries(awards(stats).map(a => [a.id, a]));
  assert.deepEqual(byId.hitRate.players, ['Anna']);
  assert.deepEqual(byId.bestRound.players, ['Anna', 'Ben']);
  assert.deepEqual(byId.worstRound.players, ['Ben', 'Cleo']);
  assert.deepEqual(awards(playerStats(createGame({ players, dealerIndex: 0 }))), []);
  assert.deepEqual(awards(playerStats(playGame([[[0, 0], [0, 0], [0, 0]]]))), []);
});

test('allTimeStats and knownPlayers', () => {
  const g1 = playGame([[[0, 0], [1, 0], [0, 1]]]);
  // Everyone hits in g2, so all three share first place.
  const g2 = { ...playGame([[[0, 0], [0, 0], [0, 0]]]), id: '2', timestamp: 2 };
  const running = createGame({ players: ['Anna', 'Dora', 'Emil'], dealerIndex: 0, now: 3 });
  const { players: table, records } = allTimeStats([g1, g2, running]);
  assert.deepEqual(table.map(e => [e.player, e.games, e.wins, e.avgPoints]),
    [['Anna', 2, 2, 20], ['Ben', 2, 1, 5], ['Cleo', 2, 1, 5]]);
  assert.deepEqual(records.highScore, { value: 20, player: 'Anna', timestamp: 1 });
  assert.deepEqual(knownPlayers([g1, g2, running]), ['Anna', 'Ben', 'Cleo', 'Dora', 'Emil']);
});
