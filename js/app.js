import {
  biddingOrder, forbiddenBid, expectedTricks, createGame, currentRound, totals, rankings,
  completeRound, canReopen, reopenLastRound, migrateGame, totalRoundsFor, clampRounds,
  rescoreRound, scoreHistory, playerStats, awards, allTimeStats, knownPlayers
} from './rules.js';

const { createApp, ref, reactive, computed, watch, onMounted } = Vue;

const STORAGE_KEY = 'wizard_games';
const SESSION_KEY = 'wizard_session';

// One color per seat, readable on the dark and the light theme.
const PLAYER_COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

const AWARDS = {
  hitRate: { icon: '🎯', title: 'Höchste Trefferquote', format: v => `${Math.round(v * 100)} %` },
  longestStreak: { icon: '🔥', title: 'Längste Serie', format: v => `${v} ${v === 1 ? 'Treffer' : 'Treffer in Folge'}` },
  bestRound: { icon: '🚀', title: 'Beste Runde', format: v => `+${v}` },
  worstRound: { icon: '💥', title: 'Größter Absturz', format: v => String(v) }
};

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
    // views: 'dashboard', 'setup', 'game', 'score', 'end', 'stats'
    const games = ref(readStorage(STORAGE_KEY, []).map(migrateGame));
    watch(games, value => writeStorage(STORAGE_KEY, value), { deep: true, immediate: true });

    // iOS often kills the PWA in the background – reopen where the user left off.
    const session = readStorage(SESSION_KEY, {}) || {};
    const sessionGame = games.value.find(g => g.id === session.gameId);
    const resumeView = sessionGame && ['game', 'score', 'end'].includes(session.view)
      ? session.view
      : session.view === 'stats' ? 'stats' : 'dashboard';
    const currentView = ref(resumeView);
    const currentGameId = ref(sessionGame && resumeView !== 'stats' ? sessionGame.id : null);
    watch([currentView, currentGameId], ([view, gameId]) => writeStorage(SESSION_KEY, { view, gameId }));

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
    const bombEnabled = ref(true);
    const cloudEnabled = ref(true);
    const setupRounds = ref(null); // empty = full game
    const isPaperResume = ref(false);
    const paperRound = ref(1);
    const paperDealerIndex = ref(0);
    const paperScores = ref({});
    const setupMaxRounds = computed(() => setupPlayers.value.length ? totalRoundsFor(setupPlayers.value.length) : 20);
    const setupTotalRounds = computed(() => clampRounds(setupRounds.value, setupPlayers.value.length || 3));
    const setupValid = computed(() => setupPlayers.value.length >= 3 && setupPlayers.value.length <= 6);
    const playerSuggestions = computed(() => knownPlayers(games.value).filter(p => !setupPlayers.value.includes(p)).slice(0, 12));

    const startNewGame = (players = [], settings = {}, totalRounds = null) => {
      setupPlayers.value = [...players];
      paperScores.value = Object.fromEntries(players.map(p => [p, 0]));
      noEvenBids.value = settings.noEvenBids ?? true;
      bombEnabled.value = settings.bomb ?? true;
      cloudEnabled.value = settings.cloud ?? true;
      setupRounds.value = totalRounds;
      isPaperResume.value = false;
      paperRound.value = 1;
      paperDealerIndex.value = 0;
      newPlayerName.value = '';
      currentView.value = 'setup';
    };

    const pushPlayer = name => {
      if (!name || setupPlayers.value.length >= 6 || setupPlayers.value.includes(name)) return false;
      setupPlayers.value.push(name);
      paperScores.value[name] = 0;
      return true;
    };

    const addPlayer = () => {
      if (pushPlayer(newPlayerName.value.trim())) newPlayerName.value = '';
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
      const options = {
        players,
        noEvenBids: noEvenBids.value,
        bomb: bombEnabled.value,
        cloud: cloudEnabled.value,
        totalRounds: setupTotalRounds.value
      };
      const game = createGame(isPaperResume.value
        ? {
            ...options,
            startRound: Math.min(Math.max(1, Math.floor(paperRound.value) || 1), setupTotalRounds.value),
            dealerIndex: paperDealerIndex.value,
            startScores: paperScores.value
          }
        : { ...options, dealerIndex: Math.floor(Math.random() * players.length) });
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
    const showStats = ref(false);

    const history = computed(() => currentGame.value ? scoreHistory(currentGame.value) : []);
    const runningTotal = (roundIndex, player) => history.value[roundIndex + 1].totals[player];
    const playerColor = player => PLAYER_COLORS[currentGame.value.players.indexOf(player) % PLAYER_COLORS.length];

    // Line chart of the running totals, drawn as plain SVG.
    const chart = computed(() => {
      const points = history.value;
      if (points.length < 2) return null;
      const width = 320;
      const height = 170;
      const pad = { left: 34, right: 8, top: 10, bottom: 20 };
      const values = points.flatMap(p => Object.values(p.totals));
      const min = Math.min(0, ...values);
      const max = Math.max(min + 10, ...values);
      const x = i => pad.left + (i * (width - pad.left - pad.right)) / (points.length - 1);
      const y = v => pad.top + ((max - v) * (height - pad.top - pad.bottom)) / (max - min);
      return {
        width,
        height,
        left: pad.left,
        right: width - pad.right,
        bottom: height - pad.bottom,
        zeroY: y(0),
        yLabels: [max, min].map(v => ({ value: v, y: y(v) })),
        xLabels: [0, points.length - 1].map(i => ({ value: points[i].roundNum, x: x(i) })),
        lines: currentGame.value.players.map(player => ({
          player,
          color: playerColor(player),
          points: points.map((p, i) => `${x(i).toFixed(1)},${y(p.totals[player]).toFixed(1)}`).join(' ')
        }))
      };
    });

    const gameStats = computed(() => currentGame.value ? playerStats(currentGame.value) : {});
    const gameAwards = computed(() => awards(gameStats.value).map(a => ({ ...a, ...AWARDS[a.id], text: AWARDS[a.id].format(a.value) })));
    const percent = v => `${Math.round(v * 100)} %`;

    // Correcting an already scored round from the history table.
    const editor = ref(null);
    const openRoundEditor = r => {
      editor.value = {
        roundNum: r.roundNum,
        dealerIndex: r.dealerIndex,
        bombPlayed: r.bombPlayed,
        bids: { ...r.bids },
        tricks: { ...r.tricks }
      };
    };
    const editorTarget = computed(() => editor.value ? expectedTricks(editor.value) : 0);
    const editorTrickSum = computed(() => editor.value ? Object.values(editor.value.tricks).reduce((a, b) => a + b, 0) : 0);
    const editorForbidden = computed(() => {
      if (!editor.value || !currentGame.value.settings.noEvenBids) return null;
      const order = biddingOrder(currentGame.value.players, editor.value.dealerIndex);
      const rule = forbiddenBid(editor.value.bids, order, editor.value.roundNum);
      return rule && editor.value.bids[rule.player] === rule.value ? rule : null;
    });
    const saveRoundEdit = () => {
      if (editorTrickSum.value !== editorTarget.value) return;
      const target = currentGame.value.rounds.find(r => r.roundNum === editor.value.roundNum);
      Object.assign(target.bids, editor.value.bids);
      Object.assign(target.tricks, editor.value.tricks);
      target.bombPlayed = editor.value.bombPlayed;
      rescoreRound(currentGame.value, target.roundNum);
      editor.value = null;
    };

    // All-time leaderboard
    const allTime = computed(() => allTimeStats(games.value));
    const openStats = () => {
      currentGameId.value = null;
      currentView.value = 'stats';
    };

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
      const { players, settings, totalRounds } = currentGame.value;
      startNewGame(players, settings, totalRounds < totalRoundsFor(players.length) ? totalRounds : null);
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
      newPlayerName, setupPlayers, noEvenBids, bombEnabled, cloudEnabled, setupRounds, setupTotalRounds,
      isPaperResume, paperRound, paperDealerIndex, paperScores, playerSuggestions,
      setupMaxRounds, setupValid, startNewGame, pushPlayer, addPlayer, removePlayer, movePlayer, initGame,
      round, numCards, dealer, orderedPlayers, currentTotals, ranking, rankOf,
      bidSum, forbidden, bidsValid, isForbidden, setBid, stepBid, finishBidding,
      trickTarget, trickSum, tricksLeft, maxTricksFor, setTricks, addTrick, removeTrick, toggleBomb, trickState,
      cloudOpen, useCloud, undoCloud, finishRound,
      scoredRounds, lastScored, hasStartScores, showHistory, runningTotal, reopenable, reopenRound,
      continueToNextRound, rematch, signed,
      showStats, chart, playerColor, gameStats, gameAwards, percent,
      editor, openRoundEditor, editorTarget, editorTrickSum, editorForbidden, saveRoundEdit,
      allTime, openStats,
      tableMode, tableFlip, tableActive, tableRows,
      confetti
    };
  }
}).mount('#app');
