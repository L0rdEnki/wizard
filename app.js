const { createApp, ref, computed, onMounted, watch } = Vue;

const app = createApp({
  setup() {
    // Theme Management
    const isLightMode = ref(false);

    const toggleTheme = () => {
      const html = document.documentElement;
      if (isLightMode.value) {
        html.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
    };

    onMounted(() => {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        isLightMode.value = true;
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        isLightMode.value = false;
        document.documentElement.setAttribute('data-theme', 'dark');
      }

      loadGames();
    });

    // App State Management
    // views: 'dashboard', 'setup', 'game', 'score', 'end'
    const currentView = ref('dashboard');

    // All saved games
    const games = ref([]);
    // Current active game
    const currentGame = ref(null);

    // Load games from localStorage
    const loadGames = () => {
      const savedGames = localStorage.getItem('wizard_games');
      if (savedGames) {
        games.value = JSON.parse(savedGames);
      }
    };

    // Save games to localStorage
    const saveGames = () => {
      localStorage.setItem('wizard_games', JSON.stringify(games.value));
    };

    // Watch current game changes to save automatically
    watch(currentGame, (newVal) => {
      if (newVal) {
        const index = games.value.findIndex(g => g.id === newVal.id);
        if (index !== -1) {
          games.value[index] = newVal;
        } else {
          games.value.push(newVal);
        }
        saveGames();
      }
    }, { deep: true });

    // Dashboard Actions
    const startNewGame = () => {
      currentView.value = 'setup';
    };

    const resumeGame = (gameId) => {
      const game = games.value.find(g => g.id === gameId);
      if (game) {
        currentGame.value = game;
        currentView.value = 'game'; // or based on state
      }
    };

    const deleteGame = (gameId) => {
      games.value = games.value.filter(g => g.id !== gameId);
      saveGames();
    };

    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };

    // Setup Actions
    const newPlayerName = ref('');
    const setupPlayers = ref([]);

    // Paper Resume State
    const isPaperResume = ref(false);
    const paperRound = ref(1);
    const paperDealerIndex = ref(0);
    const paperScores = ref({});

    const addPlayer = () => {
      const name = newPlayerName.value.trim();
      if (name && !setupPlayers.value.includes(name)) {
        setupPlayers.value.push(name);
        paperScores.value[name] = 0; // Initialize score for paper resume
        newPlayerName.value = '';
      }
    };

    const removePlayer = (index) => {
      const name = setupPlayers.value[index];
      delete paperScores.value[name];
      setupPlayers.value.splice(index, 1);
    };

    // Make sure paper round is valid
    watch([paperRound, setupPlayers], () => {
        if (setupPlayers.value.length > 0) {
            const maxRounds = 60 / setupPlayers.value.length;
            if (paperRound.value > maxRounds) paperRound.value = maxRounds;
            if (paperRound.value < 1) paperRound.value = 1;
        }
    }, { deep: true });

    const initGame = () => {
      if (setupPlayers.value.length < 3 || setupPlayers.value.length > 6) {
        alert("Bitte 3 bis 6 Spieler eintragen.");
        return;
      }

      const totalRounds = 60 / setupPlayers.value.length;

      let startRound = 1;
      let dealerIdx = Math.floor(Math.random() * setupPlayers.value.length);

      if (isPaperResume.value) {
          startRound = parseInt(paperRound.value);
          dealerIdx = parseInt(paperDealerIndex.value);
      }

      const newGame = {
        id: Date.now().toString(),
        name: isPaperResume.value ? `Fortgesetzt vom ${formatDate(Date.now())}` : `Spiel vom ${formatDate(Date.now())}`,
        timestamp: Date.now(),
        players: [...setupPlayers.value],
        totalRounds: totalRounds,
        currentRound: startRound,
        dealerIndex: dealerIdx,
        state: 'bidding', // 'bidding', 'playing', 'finished'
        rounds: [],
        totalScores: {}
      };

      // Initialize scores
      setupPlayers.value.forEach(p => {
          newGame.totalScores[p] = isPaperResume.value ? (parseInt(paperScores.value[p]) || 0) : 0;
      });

      // Initialize first round bids with 0
      const initialBids = {};
      setupPlayers.value.forEach(p => initialBids[p] = 0);

      newGame.rounds[startRound - 1] = {
        roundNum: startRound,
        bids: initialBids,
        tricks: {},
        bombPlayed: false
      };

      currentGame.value = newGame;
      games.value.push(newGame);
      saveGames();

      // Reset setup state
      setupPlayers.value = [];
      isPaperResume.value = false;
      paperRound.value = 1;
      paperDealerIndex.value = 0;
      paperScores.value = {};

      currentView.value = 'game';
    };

    const goHome = () => {
      currentGame.value = null;
      currentView.value = 'dashboard';
    };
    // Game Loop Computed Properties
    const currentRoundObj = computed(() => {
      if (!currentGame.value) return null;
      return currentGame.value.rounds[currentGame.value.currentRound - 1];
    });

    const numCards = computed(() => {
      if (!currentGame.value) return 0;
      return currentGame.value.currentRound;
    });

    const orderedPlayers = computed(() => {
      if (!currentGame.value) return [];
      const players = currentGame.value.players;
      const dealerIdx = currentGame.value.dealerIndex;
      const ordered = [];
      for (let i = 1; i <= players.length; i++) {
        ordered.push(players[(dealerIdx + i) % players.length]);
      }
      return ordered;
    });

    const totalTricks = computed(() => {
      if (!currentRoundObj.value) return 0;
      return Object.values(currentRoundObj.value.tricks).reduce((a, b) => a + (b || 0), 0);
    });

    const expectedTricks = computed(() => {
      if (!currentRoundObj.value) return 0;
      return currentRoundObj.value.bombPlayed ? numCards.value - 1 : numCards.value;
    });

    const toggleBomb = () => {
      if (currentRoundObj.value) {
        currentRoundObj.value.bombPlayed = !currentRoundObj.value.bombPlayed;
      }
    };

    // Game Actions
    const incrementBid = (player) => {
      if (currentRoundObj.value.bids[player] === undefined) {
        currentRoundObj.value.bids[player] = 0;
      }
      if (currentRoundObj.value.bids[player] < numCards.value) {
        currentRoundObj.value.bids[player]++;
      }
    };

    const decrementBid = (player) => {
      if (currentRoundObj.value.bids[player] === undefined) {
        currentRoundObj.value.bids[player] = 0;
      }
      if (currentRoundObj.value.bids[player] > 0) {
        currentRoundObj.value.bids[player]--;
      }
    };

    const setBid = (player, val) => {
        currentRoundObj.value.bids[player] = val;
    }

    const finishBidding = () => {
      // Check if all players have bid
      const players = currentGame.value.players;
      const allBid = players.every(p => currentRoundObj.value.bids[p] !== undefined);
      if (!allBid) {
        alert("Bitte für alle Spieler einen Tipp eintragen.");
        return;
      }

      // Initialize tricks with 0
      players.forEach(p => {
        currentRoundObj.value.tricks[p] = 0;
      });

      currentGame.value.state = 'playing';
    };

    const incrementTrick = (player) => {
      if (totalTricks.value < expectedTricks.value) {
        currentRoundObj.value.tricks[player]++;
      }
    };

    const decrementTrick = (player) => {
      if (currentRoundObj.value.tricks[player] > 0) {
        currentRoundObj.value.tricks[player]--;
      }
    };

    const editBids = () => {
      // Wolke funktion - special edit view
      currentGame.value.state = 'cloud';
    };

    const cloudIncrement = (player) => {
      if (currentRoundObj.value.bids[player] < numCards.value) {
        currentRoundObj.value.bids[player]++;
        finishCloudEdit();
      }
    };

    const cloudDecrement = (player) => {
      if (currentRoundObj.value.bids[player] > 0) {
        currentRoundObj.value.bids[player]--;
        finishCloudEdit();
      }
    };

    const finishCloudEdit = () => {
       currentGame.value.state = 'playing';
       saveGames();
    };

    const finishRound = () => {
      if (totalTricks.value !== expectedTricks.value) {
        alert(`Die Summe der Stiche (${totalTricks.value}) muss genau der erwarteten Anzahl an Stichen (${expectedTricks.value}) entsprechen!`);
        return;
      }

      // Calculate scores
      const players = currentGame.value.players;
      currentRoundObj.value.scores = {};

      players.forEach(p => {
        const bid = currentRoundObj.value.bids[p];
        const trick = currentRoundObj.value.tricks[p];
        let roundScore = 0;

        if (bid === trick) {
          roundScore = 20 + (trick * 10);
        } else {
          const diff = Math.abs(bid - trick);
          roundScore = -(diff * 10);
        }

        currentRoundObj.value.scores[p] = roundScore;
        currentGame.value.totalScores[p] += roundScore;
      });

      // Check for game end
      if (currentGame.value.currentRound >= currentGame.value.totalRounds) {
        currentGame.value.state = 'finished';
        currentView.value = 'end';
      } else {
        // Next round setup
        currentGame.value.currentRound++;
        currentGame.value.dealerIndex = (currentGame.value.dealerIndex + 1) % players.length;
        currentGame.value.state = 'bidding';

        const nextBids = {};
        players.forEach(p => nextBids[p] = 0);

        currentGame.value.rounds.push({
          roundNum: currentGame.value.currentRound,
          bids: nextBids,
          tricks: {},
          bombPlayed: false
        });
        currentView.value = 'score'; // Show score table between rounds
      }
    };

    const continueToNextRound = () => {
        currentView.value = 'game';
    };
    // End Game Logic
    const sortedPlayersByScore = computed(() => {
      if (!currentGame.value) return [];
      const players = [...currentGame.value.players];
      return players.sort((a, b) => currentGame.value.totalScores[b] - currentGame.value.totalScores[a]);
    });

    const archiveGame = () => {
      currentGame.value.state = 'archived';
      currentView.value = 'dashboard';
      currentGame.value = null;
    };

    const rematch = () => {
      const players = [...currentGame.value.players];
      currentGame.value.state = 'archived';

      setupPlayers.value = players;
      currentView.value = 'setup';
      currentGame.value = null;
    };

    // Confetti simulation using CSS classes added to body,
    // but in a real PWA we'd use a small canvas or CSS keyframes
    const triggerConfetti = () => {
        // We'll handle this in the template via a CSS overlay
    };

    // Watch for view change to trigger confetti
    watch(currentView, (newVal) => {
        if(newVal === 'end') {
            triggerConfetti();
        }
    });



    return {

      sortedPlayersByScore,
      archiveGame,
      rematch,


      currentRoundObj,
      numCards,
      orderedPlayers,
      totalTricks,
      expectedTricks,
      toggleBomb,
      incrementBid,
      decrementBid,
      setBid,
      finishBidding,
      incrementTrick,
      decrementTrick,
      editBids,
      cloudIncrement,
      cloudDecrement,
      finishCloudEdit,
      finishRound,
      continueToNextRound,

      isLightMode,
      toggleTheme,

      currentView,
      games,
      currentGame,
      formatDate,

      startNewGame,
      resumeGame,
      deleteGame,
      goHome,

      newPlayerName,
      setupPlayers,
      isPaperResume,
      paperRound,
      paperDealerIndex,
      paperScores,
      addPlayer,
      removePlayer,
      initGame
    };
  }
});

app.mount('#app');
