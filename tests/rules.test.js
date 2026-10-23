import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundScore, biddingOrder, forbiddenBid, expectedTricks, createGame, currentRound,
  totals, rankings, completeRound, canReopen, reopenLastRound, migrateGame
} from '../js/rules.js';

const players = ['Anna', 'Ben', 'Cleo'];

test('roundScore', () => {
  assert.equal(roundScore(0, 0), 20);
  assert.equal(roundScore(3, 3), 50);
  assert.equal(roundScore(2, 0), -20);
  assert.equal(roundScore(0, 3), -30);
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
  assert.equal(game.version, 2);
  assert.equal(game.state, 'playing');
  assert.equal(game.rounds.length, 2);
  assert.deepEqual(game.startScores, { Anna: 100, Ben: 0, Cleo: 40 });
  assert.deepEqual(totals(game), old.totalScores);
  assert.equal(game.rounds[0].dealerIndex, 2);
  assert.equal(game.rounds[1].dealerIndex, 0);
  assert.deepEqual(game.rounds[1].tricks, { Anna: 0, Ben: 0, Cleo: 0 });
  assert.equal(game.settings.noEvenBids, false);
  assert.equal(migrateGame(game), game);
  assert.equal(migrateGame({ ...old, state: 'archived' }).state, 'finished');
});
