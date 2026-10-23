import {
  biddingOrder, forbiddenBid, expectedTricks, createGame, currentRound, totals, rankings,
  completeRound, canReopen, reopenLastRound, migrateGame, totalRoundsFor
} from './rules.js';

const { createApp, ref, reactive, computed, watch, onMounted } = Vue;

const STORAGE_KEY = 'wizard_games';

const readStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked – the game keeps running in memory.
  }
};

createApp({
  setup() {
    // Theme
    const isLightMode = ref(readStorage('theme', 'dark') === 'light');
    const applyTheme = () => {
      const theme = isLightMode.value ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      writeStorage('theme', theme);
    };
    watch(isLightMode, applyTheme, { immediate: true });

    // Games – the array is the single source of truth and is saved on every change.
    // views: 'dashboard', 'setup', 'game', 'score', 'end'
    const currentView = ref('dashboard');
    const games = ref(readStorage(STORAGE_KEY, []).map(migrateGame));
    const currentGameId = ref(null);
    watch(games, value => writeStorage(STORAGE_KEY, value), { deep: true, immediate: true });

    const currentGame = computed(() => games.value.find(g => g.id === currentGameId.value) || null);
    const runningGames = computed(() => games.value.filter(g => g.state !== 'finished').reverse());
    const finishedGames = computed(() => games.value.filter(g => g.state === 'finished').reverse());

    const formatDate = timestamp => new Date(timestamp).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const leaderOf = game => rankings(game.players, totals(game))[0];

    const openGame = game => {
      currentGameId.value = game.id;
      currentView.value = game.state === 'finished' ? 'end' : 'game';
    };

    const deleteGame = game => {
      if (confirm(`Spiel vom ${formatDate(game.timestamp)} wirklich löschen?`)) {
        games.value = games.value.filter(g => g.id !== game.id);
      }
    };

    const goHome = () => {
      currentGameId.value = null;
      currentView.value = 'dashboard';
    };

    // Setup
    const newPlayerName = ref('');
    const setupPlayers = ref([]);
    const noEvenBids = ref(true);
    const isPaperResume = ref(false);
    const paperRound = ref(1);
    const paperDealerIndex = ref(0);
    const paperScores = ref({});
    const setupMaxRounds = computed(() => setupPlayers.value.length ? totalRoundsFor(setupPlayers.value.length) : 20);
    const setupValid = computed(() => setupPlayers.value.length >= 3 && setupPlayers.value.length <= 6);

    const startNewGame = (players = []) => {
      setupPlayers.value = [...players];
      paperScores.value = Object.fromEntries(players.map(p => [p, 0]));
      isPaperResume.value = false;
      paperRound.value = 1;
      paperDealerIndex.value = 0;
      newPlayerName.value = '';
      currentView.value = 'setup';
    };

    const addPlayer = () => {
      const name = newPlayerName.value.trim();
      if (name && setupPlayers.value.length < 6 && !setupPlayers.value.includes(name)) {
        setupPlayers.value.push(name);
        paperScores.value[name] = 0;
        newPlayerName.value = '';
      }
    };

    const removePlayer = index => {
      delete paperScores.value[setupPlayers.value[index]];
      setupPlayers.value.splice(index, 1);
      if (paperDealerIndex.value >= setupPlayers.value.length) paperDealerIndex.value = 0;
    };

    const movePlayer = (index, dir) => {
      const list = setupPlayers.value;
      const target = index + dir;
      if (target < 0 || target >= list.length) return;
      [list[index], list[target]] = [list[target], list[index]];
    };

    const initGame = () => {
      if (!setupValid.value) return;
      const players = setupPlayers.value;
      const game = createGame(isPaperResume.value
        ? {
            players,
            noEvenBids: noEvenBids.value,
            startRound: Math.min(Math.max(1, Math.floor(paperRound.value) || 1), setupMaxRounds.value),
            dealerIndex: paperDealerIndex.value,
            startScores: paperScores.value
          }
        : { players, noEvenBids: noEvenBids.value, dealerIndex: Math.floor(Math.random() * players.length) });
      games.value.push(game);
      openGame(game);
    };

    // Current round
    const round = computed(() => currentGame.value && currentRound(currentGame.value));
    const numCards = computed(() => round.value ? round.value.roundNum : 0);
    const dealer = computed(() => round.value ? currentGame.value.players[round.value.dealerIndex] : '');
    const orderedPlayers = computed(() => round.value ? biddingOrder(currentGame.value.players, round.value.dealerIndex) : []);
    const currentTotals = computed(() => currentGame.value ? totals(currentGame.value) : {});
    const ranking = computed(() => currentGame.value ? rankings(currentGame.value.players, currentTotals.value) : []);
    const rankOf = computed(() => Object.fromEntries(ranking.value.map(r => [r.player, r.rank])));

    // Bidding
    const bidSum = computed(() => round.value ? orderedPlayers.value.reduce((s, p) => s + round.value.bids[p], 0) : 0);
    const forbidden = computed(() => {
      if (!round.value || !currentGame.value.settings.noEvenBids) return null;
      return forbiddenBid(round.value.bids, orderedPlayers.value, numCards.value);
    });
    const bidsValid = computed(() => !forbidden.value || round.value.bids[forbidden.value.player] !== forbidden.value.value);
    const isForbidden = (player, value) => Boolean(forbidden.value && forbidden.value.player === player && forbidden.value.value === value);

    const setBid = (player, value) => {
      if (value >= 0 && value <= numCards.value && !isForbidden(player, value)) {
        round.value.bids[player] = value;
      }
    };

    // Step over the forbidden value instead of getting stuck on it.
    const stepBid = (player, dir) => {
      let value = round.value.bids[player] + dir;
      if (isForbidden(player, value)) value += dir;
      setBid(player, value);
    };

    const finishBidding = () => {
      if (!bidsValid.value) return;
      currentGame.value.players.forEach(p => { round.value.tricks[p] = 0; });
      trickTouched.clear();
      currentGame.value.state = 'playing';
    };

    // Tricks
    const trickTarget = computed(() => round.value ? expectedTricks(round.value) : 0);
    const trickSum = computed(() => round.value ? currentGame.value.players.reduce((s, p) => s + (round.value.tricks[p] || 0), 0) : 0);
    const tricksLeft = computed(() => trickTarget.value - trickSum.value);

    // Players whose trick count was picked by hand; the single remaining one gets the rest automatically.
    const trickTouched = reactive(new Set());
    watch(() => round.value && `${currentGame.value.id}:${round.value.roundNum}`, () => trickTouched.clear());

    const autoTrickPlayer = player => {
      const open = currentGame.value.players.filter(p => p !== player && !trickTouched.has(p));
      return open.length === 1 ? open[0] : null;
    };

    const maxTricksFor = player => {
      const auto = autoTrickPlayer(player);
      const others = currentGame.value.players
        .filter(p => p !== player && p !== auto)
        .reduce((s, p) => s + round.value.tricks[p], 0);
      return trickTarget.value - others;
    };

    const setTricks = (player, value) => {
      if (value < 0 || value > maxTricksFor(player)) return;
      const auto = autoTrickPlayer(player);
      round.value.tricks[player] = value;
      trickTouched.add(player);
      if (auto) {
        const others = currentGame.value.players.filter(p => p !== auto).reduce((s, p) => s + round.value.tricks[p], 0);
        round.value.tricks[auto] = Math.max(0, trickTarget.value - others);
      }
    };

    // Live counting: one tap per trick won.
    const addTrick = player => {
      if (tricksLeft.value > 0) round.value.tricks[player]++;
    };

    const removeTrick = player => {
      if (round.value.tricks[player] > 0) round.value.tricks[player]--;
    };

    const toggleBomb = () => {
      round.value.bombPlayed = !round.value.bombPlayed;
      // Keep the distributed tricks within the new target.
      while (tricksLeft.value < 0) {
        const top = [...orderedPlayers.value].reverse().find(p => round.value.tricks[p] > 0);
        round.value.tricks[top]--;
      }
    };

    const trickState = player => {
      const { bids, tricks } = round.value;
      if (tricks[player] > bids[player]) return 'over';
      if (tricks[player] === bids[player]) return 'hit';
      return tricksLeft.value === 0 ? 'miss' : 'open';
    };

    // Cloud: one player changes their bid by ±1 during the round.
    const cloudOpen = ref(false);
    const useCloud = (player, dir) => {
      const value = round.value.bids[player] + dir;
      if (value < 0 || value > numCards.value) return;
      round.value.bids[player] = value;
      round.value.cloudUsedBy = { player, dir };
      cloudOpen.value = false;
    };

    const undoCloud = () => {
      const { player, dir } = round.value.cloudUsedBy;
      round.value.bids[player] -= dir;
      round.value.cloudUsedBy = null;
    };

    const finishRound = () => {
      if (tricksLeft.value !== 0) return;
      cloudOpen.value = false;
      currentView.value = completeRound(currentGame.value) === 'finished' ? 'end' : 'score';
    };

    // Scores
    const scoredRounds = computed(() => currentGame.value ? currentGame.value.rounds.filter(r => r.scores) : []);
    const lastScored = computed(() => scoredRounds.value[scoredRounds.value.length - 1] || null);
    const hasStartScores = computed(() => Boolean(currentGame.value && Object.values(currentGame.value.startScores).some(Boolean)));
    const showHistory = ref(false);

    const runningTotal = (roundIndex, player) => currentGame.value.startScores[player] +
      scoredRounds.value.slice(0, roundIndex + 1).reduce((s, r) => s + r.scores[player], 0);

    const reopenable = computed(() => Boolean(currentGame.value && canReopen(currentGame.value)));
    const reopenRound = () => {
      if (confirm(`Runde ${lastScored.value.roundNum} wieder öffnen? Die Wertung dieser Runde wird zurückgesetzt.`)) {
        reopenLastRound(currentGame.value);
        trickTouched.clear();
        currentView.value = 'game';
      }
    };

    const continueToNextRound = () => { currentView.value = 'game'; };
    const rematch = () => {
      const { players, settings } = currentGame.value;
      noEvenBids.value = settings.noEvenBids;
      startNewGame(players);
    };

    const signed = n => (n > 0 ? `+${n}` : String(n));

    // Table mode
    const tableMode = ref(readStorage('tableMode', false));
    const tableFlip = ref(readStorage('tableFlip', false));
    watch(tableMode, v => writeStorage('tableMode', v));
    watch(tableFlip, v => writeStorage('tableFlip', v));
    const tableActive = computed(() => tableMode.value && currentGame.value && ['game', 'score'].includes(currentView.value));

    // Seats run clockwise: bottom row left→right, then the (rotated) top row right→left.
    const tableRows = computed(() => {
      if (!currentGame.value) return [];
      const players = currentGame.value.players;
      if (!tableFlip.value) return [{ flipped: false, players }];
      const bottomCount = Math.ceil(players.length / 2);
      return [
        { flipped: true, players: players.slice(bottomCount).reverse() },
        { flipped: false, players: players.slice(0, bottomCount) }
      ];
    });

    // Keep the screen on while the device lies on the table.
    let wakeLock = null;
    const syncWakeLock = async () => {
      try {
        if (tableActive.value && document.visibilityState === 'visible' && !wakeLock && 'wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => { wakeLock = null; });
        } else if (!tableActive.value && wakeLock) {
          await wakeLock.release();
          wakeLock = null;
        }
      } catch {
        wakeLock = null;
      }
    };
    watch(tableActive, syncWakeLock);
    onMounted(() => {
      document.addEventListener('visibilitychange', syncWakeLock);
      syncWakeLock();
    });

    const confetti = Array.from({ length: 50 }, () => ({
      delay: `${(Math.random() * 3).toFixed(2)}s`,
      color: `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`,
      x: `${(Math.random() * 100).toFixed(1)}vw`
    }));

    return {
      isLightMode,
      currentView, games, currentGame, runningGames, finishedGames, formatDate, leaderOf, totals,
      openGame, deleteGame, goHome,
      newPlayerName, setupPlayers, noEvenBids, isPaperResume, paperRound, paperDealerIndex, paperScores,
      setupMaxRounds, setupValid, startNewGame, addPlayer, removePlayer, movePlayer, initGame,
      round, numCards, dealer, orderedPlayers, currentTotals, ranking, rankOf,
      bidSum, forbidden, bidsValid, isForbidden, setBid, stepBid, finishBidding,
      trickTarget, trickSum, tricksLeft, maxTricksFor, setTricks, addTrick, removeTrick, toggleBomb, trickState,
      cloudOpen, useCloud, undoCloud, finishRound,
      scoredRounds, lastScored, hasStartScores, showHistory, runningTotal, reopenable, reopenRound,
      continueToNextRound, rematch, signed,
      tableMode, tableFlip, tableActive, tableRows,
      confetti
    };
  }
}).mount('#app');
