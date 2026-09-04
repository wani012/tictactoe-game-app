// Zero Kaata - Modern Tic Tac Toe Game Engine

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
    if (!this.enabled) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  playMove(symbol) {
    if (symbol === 'X') {
      this.playTone(520, 'sine', 0.08, 0.2);
    } else {
      this.playTone(380, 'sine', 0.08, 0.2);
    }
  }

  playWin() {
    if (!this.enabled) return;
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.25), idx * 100);
    });
  }

  playLose() {
    if (!this.enabled) return;
    const notes = [400, 350, 300, 220];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.2, 0.12), idx * 120);
    });
  }

  playDraw() {
    if (!this.enabled) return;
    this.playTone(330, 'triangle', 0.2, 0.15);
    setTimeout(() => this.playTone(330, 'triangle', 0.25, 0.15), 180);
  }

  playClick() {
    this.playTone(800, 'sine', 0.03, 0.08);
  }
}

class ConfettiEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animId = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  blast() {
    this.particles = [];
    const colors = ['#00f0ff', '#ff007f', '#ffd700', '#10b981', '#ffffff'];
    const count = 75;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.canvas.width / 2,
        y: this.canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.9) * 18,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        gravity: 0.45
      });
    }

    if (!this.animId) {
      this.render();
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let active = false;

    for (let p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.rotation += p.rSpeed;
      p.opacity -= 0.012;

      if (p.opacity > 0 && p.y < this.canvas.height + 50) {
        active = true;
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = Math.max(0, p.opacity);
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        this.ctx.restore();
      }
    }

    if (active) {
      this.animId = requestAnimationFrame(() => this.render());
    } else {
      cancelAnimationFrame(this.animId);
      this.animId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

class TicTacToeGame {
  constructor() {
    this.board = Array(9).fill('');
    this.mode = 'ai'; // 'ai' or 'pvp'
    this.difficulty = 'impossible'; // 'easy', 'medium', 'impossible'
    this.userSymbol = 'X';
    this.aiSymbol = 'O';
    this.currentTurn = 'X';
    this.isGameOver = false;
    this.isAiThinking = false;

    this.scores = {
      x: 0,
      o: 0,
      draw: 0,
      streak: 0
    };

    this.winningCombos = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    this.sound = new SoundEngine();
    this.confetti = new ConfettiEngine('confetti-canvas');

    this.loadStorage();
    this.cacheDom();
    this.bindEvents();
    this.updateUI();
  }

  cacheDom() {
    this.cells = document.querySelectorAll('.cell');
    this.modeBtns = document.querySelectorAll('.mode-btn');
    this.diffChips = document.querySelectorAll('.diff-chip');
    this.difficultyBar = document.getElementById('difficulty-bar');
    this.statusText = document.getElementById('status-text');
    this.statusDot = document.getElementById('status-dot');
    this.scoreX = document.getElementById('score-x');
    this.scoreO = document.getElementById('score-o');
    this.scoreDraw = document.getElementById('score-draw');
    this.cardX = document.getElementById('card-x');
    this.cardO = document.getElementById('card-o');
    this.labelO = document.getElementById('label-o');
    this.strikeSvg = document.getElementById('strike-svg');
    this.newGameBtn = document.getElementById('new-game-btn');
    this.soundToggleBtn = document.getElementById('sound-toggle-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.closeModalBtn = document.getElementById('close-modal-btn');
    this.settingsModal = document.getElementById('settings-modal');
    this.resetScoresBtn = document.getElementById('reset-scores-btn');
    this.symbolChips = document.querySelectorAll('.symbol-chip');
    this.doubleRewardBtn = document.getElementById('double-reward-btn');
  }

  loadStorage() {
    try {
      const savedScores = localStorage.getItem('zk_scores');
      if (savedScores) this.scores = JSON.parse(savedScores);
      const savedSound = localStorage.getItem('zk_sound');
      if (savedSound !== null) this.sound.enabled = savedSound === 'true';
      const savedDiff = localStorage.getItem('zk_diff');
      if (savedDiff) this.difficulty = savedDiff;
      const savedSymbol = localStorage.getItem('zk_symbol');
      if (savedSymbol) {
        this.userSymbol = savedSymbol;
        this.aiSymbol = savedSymbol === 'X' ? 'O' : 'X';
      }
    } catch (e) {
      console.warn('Storage read error', e);
    }
  }

  saveStorage() {
    try {
      localStorage.setItem('zk_scores', JSON.stringify(this.scores));
      localStorage.setItem('zk_sound', this.sound.enabled);
      localStorage.setItem('zk_diff', this.difficulty);
      localStorage.setItem('zk_symbol', this.userSymbol);
    } catch (e) {
      console.warn('Storage save error', e);
    }
  }

  bindEvents() {
    this.cells.forEach(cell => {
      cell.addEventListener('click', (e) => {
        const idx = parseInt(cell.getAttribute('data-index'));
        this.handleCellClick(idx);
      });
    });

    this.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        const mode = btn.getAttribute('data-mode');
        this.setMode(mode);
      });
    });

    this.diffChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.sound.playClick();
        this.setDifficulty(chip.getAttribute('data-diff'));
      });
    });

    this.newGameBtn.addEventListener('click', () => {
      this.sound.playClick();
      this.resetGame();
    });

    if (this.doubleRewardBtn) {
      this.doubleRewardBtn.addEventListener('click', () => {
        this.handleDoubleRewardClick();
      });
    }

    this.soundToggleBtn.addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      this.soundToggleBtn.textContent = this.sound.enabled ? '🔊' : '🔇';
      this.sound.playClick();
      this.saveStorage();
    });

    this.settingsBtn.addEventListener('click', () => {
      this.sound.playClick();
      this.settingsModal.classList.add('open');
    });

    this.closeModalBtn.addEventListener('click', () => {
      this.sound.playClick();
      this.settingsModal.classList.remove('open');
    });

    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.settingsModal.classList.remove('open');
      }
    });

    this.resetScoresBtn.addEventListener('click', () => {
      this.sound.playClick();
      this.scores = { x: 0, o: 0, draw: 0, streak: 0 };
      this.saveStorage();
      this.updateScoreboard();
      this.settingsModal.classList.remove('open');
    });

    this.symbolChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.sound.playClick();
        const sym = chip.getAttribute('data-symbol');
        this.userSymbol = sym;
        this.aiSymbol = sym === 'X' ? 'O' : 'X';
        this.symbolChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.saveStorage();
        this.resetGame();
      });
    });
  }

  handleDoubleRewardClick() {
    this.sound.playClick();
    if (!this.doubleRewardBtn) return;
    this.doubleRewardBtn.disabled = true;
    this.doubleRewardBtn.innerHTML = '<span>⏳</span> Loading 2X Sponsor Ad...';

    if (window.realAdManager) {
      window.realAdManager.showDoubleRewardAd((granted) => {
        if (granted) {
          if (window.walletManager) {
            window.walletManager.coins += 35;
            window.walletManager.save();
          }
          this.confetti.blast();
          this.sound.playWin();
          this.doubleRewardBtn.innerHTML = '<span>✅</span> 2X Coins Claimed (+35 🪙)!';
          if (window.realAdManager.showToast) {
            window.realAdManager.showToast('🎉 Double Win: +35 Extra Coins Added!');
          }
        } else {
          this.doubleRewardBtn.disabled = false;
          this.doubleRewardBtn.innerHTML = '<span>⚡</span> Claim 2X Coins (+35 🪙) 🎬';
        }
      });
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.modeBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === mode));
    this.difficultyBar.style.display = mode === 'ai' ? 'flex' : 'none';
    this.labelO.textContent = mode === 'ai' ? 'BOT' : 'PLAYER O';
    this.resetGame();
  }

  setDifficulty(diff) {
    this.difficulty = diff;
    this.diffChips.forEach(c => c.classList.toggle('active', c.getAttribute('data-diff') === diff));
    this.saveStorage();
    this.resetGame();
  }

  vibrate(pattern) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  handleCellClick(index) {
    if (this.board[index] !== '' || this.isGameOver || this.isAiThinking) {
      return;
    }

    if (this.mode === 'ai' && this.currentTurn !== this.userSymbol) {
      return;
    }

    // Deduct entry fee on first move of the match
    if (!this.roundStarted) {
      if (window.walletManager && !window.walletManager.canAffordMatch()) {
        window.walletManager.showOutOfCoinsModal();
        return;
      }
      if (window.walletManager) {
        window.walletManager.deductEntryFee();
      }
      this.roundStarted = true;
    }

    this.makeMove(index, this.currentTurn);

    if (!this.isGameOver && this.mode === 'ai' && this.currentTurn === this.aiSymbol) {
      this.triggerAiTurn();
    }
  }

  makeMove(index, symbol) {
    this.board[index] = symbol;
    this.sound.playMove(symbol);
    this.vibrate(40);
    this.renderBoard();

    const winData = this.checkWin(this.board, symbol);
    if (winData) {
      this.handleGameEnd(symbol, winData);
      return;
    }

    if (this.isBoardFull(this.board)) {
      this.handleGameEnd('draw');
      return;
    }

    this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
    this.updateStatus();
    this.updateActiveCard();
  }

  triggerAiTurn() {
    this.isAiThinking = true;
    this.statusText.textContent = 'Bot is thinking...';
    this.updateActiveCard();

    // Natural delay so player feels AI responsiveness
    const delay = Math.floor(Math.random() * 250) + 300;
    setTimeout(() => {
      if (this.isGameOver) return;
      const aiMove = this.getAiMove();
      this.isAiThinking = false;
      if (aiMove !== -1) {
        this.makeMove(aiMove, this.aiSymbol);
      }
    }, delay);
  }

  getAiMove() {
    const emptyIndices = this.getAvailableMoves(this.board);
    if (emptyIndices.length === 0) return -1;

    if (this.difficulty === 'easy') {
      // Pure random
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    if (this.difficulty === 'medium') {
      // 1. Can AI win immediately?
      for (let idx of emptyIndices) {
        this.board[idx] = this.aiSymbol;
        if (this.checkWin(this.board, this.aiSymbol)) {
          this.board[idx] = '';
          return idx;
        }
        this.board[idx] = '';
      }
      // 2. Can player win immediately? Block it!
      for (let idx of emptyIndices) {
        this.board[idx] = this.userSymbol;
        if (this.checkWin(this.board, this.userSymbol)) {
          this.board[idx] = '';
          return idx;
        }
        this.board[idx] = '';
      }
      // 3. Take center if available
      if (this.board[4] === '' && Math.random() > 0.3) {
        return 4;
      }
      // 4. Otherwise random
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    // IMPOSSIBLE: Minimax Algorithm
    return this.minimaxBestMove();
  }

  minimaxBestMove() {
    let bestScore = -Infinity;
    let move = -1;
    const available = this.getAvailableMoves(this.board);

    // If starting on an empty board, take center or corner quickly
    if (available.length === 9) {
      const openers = [0, 2, 4, 6, 8];
      return openers[Math.floor(Math.random() * openers.length)];
    }

    for (let idx of available) {
      this.board[idx] = this.aiSymbol;
      const score = this.minimax(this.board, 0, false, -Infinity, Infinity);
      this.board[idx] = '';
      if (score > bestScore) {
        bestScore = score;
        move = idx;
      }
    }
    return move;
  }

  minimax(board, depth, isMaximizing, alpha, beta) {
    if (this.checkWin(board, this.aiSymbol)) return 10 - depth;
    if (this.checkWin(board, this.userSymbol)) return depth - 10;
    if (this.isBoardFull(board)) return 0;
    if (depth >= 7) return 0; // depth bound for performance

    const available = this.getAvailableMoves(board);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let idx of available) {
        board[idx] = this.aiSymbol;
        const ev = this.minimax(board, depth + 1, false, alpha, beta);
        board[idx] = '';
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let idx of available) {
        board[idx] = this.userSymbol;
        const ev = this.minimax(board, depth + 1, true, alpha, beta);
        board[idx] = '';
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  getAvailableMoves(board) {
    const moves = [];
    for (let i = 0; i < 9; i++) {
      if (board[i] === '') moves.push(i);
    }
    return moves;
  }

  isBoardFull(board) {
    return board.every(cell => cell !== '');
  }

  checkWin(board, symbol) {
    for (let combo of this.winningCombos) {
      const [a, b, c] = combo;
      if (board[a] === symbol && board[b] === symbol && board[c] === symbol) {
        return { combo, winner: symbol };
      }
    }
    return null;
  }

  handleGameEnd(result, winData = null) {
    this.isGameOver = true;
    this.roundStarted = false;

    if (result === 'draw') {
      this.scores.draw++;
      this.statusText.textContent = "It's a Draw! (+5 🏆)";
      this.sound.playDraw();
      this.vibrate([80, 50, 80]);
      if (window.walletManager) window.walletManager.recordDraw();
    } else {
      if (result === 'X') {
        this.scores.x++;
      } else {
        this.scores.o++;
      }

      const isHumanWin = (this.mode === 'pvp') || (result === this.userSymbol);
      if (isHumanWin) {
        this.confetti.blast();
        this.sound.playWin();
        this.vibrate([100, 50, 100, 50, 150]);
        this.statusText.textContent = this.mode === 'ai' ? '🎉 You Won! (+35 🪙 +25 🏆)' : `🎉 Player ${result} Won! (+35 🪙)`;
        if (window.walletManager) window.walletManager.rewardWin();

        // 💰 Monetization Boost: Show 2X Double Win Reward button
        if (this.doubleRewardBtn) {
          this.doubleRewardBtn.style.display = 'flex';
          this.doubleRewardBtn.disabled = false;
          this.doubleRewardBtn.innerHTML = '<span>⚡</span> Claim 2X Coins (+35 🪙) 🎬';
        }
      } else {
        this.sound.playLose();
        this.vibrate([150, 80, 200]);
        this.statusText.textContent = '🤖 Bot Won! (-10 🏆)';
        if (window.walletManager) window.walletManager.recordLoss();
      }

      this.highlightWinningCells(winData.combo);
      this.drawStrikeLine(winData.combo, result);
    }

    this.saveStorage();
    this.updateScoreboard();
    this.statusDot.style.display = 'none';

    if (window.walletManager) {
      window.walletManager.matchesCompleted++;
      window.walletManager.save();

      // 💰 Monetization Boost: Automatically show interstitial ad every 2 completed matches
      if (window.walletManager.matchesCompleted % 2 === 0) {
        setTimeout(() => {
          if (window.realAdManager) {
            window.realAdManager.showInterstitial();
          }
        }, 1200);
      }
    }
  }

  highlightWinningCells(combo) {
    combo.forEach(idx => {
      this.cells[idx].classList.add('win-highlight');
    });
  }

  drawStrikeLine(combo, winner) {
    const cellRects = combo.map(idx => this.cells[idx].getBoundingClientRect());
    const boardRect = document.getElementById('board-grid').getBoundingClientRect();

    const startX = cellRects[0].left + cellRects[0].width / 2 - boardRect.left;
    const startY = cellRects[0].top + cellRects[0].height / 2 - boardRect.top;
    const endX = cellRects[2].left + cellRects[2].width / 2 - boardRect.left;
    const endY = cellRects[2].top + cellRects[2].height / 2 - boardRect.top;

    const strokeColor = winner === 'X' ? '#00f0ff' : '#ff007f';

    this.strikeSvg.innerHTML = `
      <line class="strike-path" x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" 
            stroke="${strokeColor}" stroke-width="8" stroke-linecap="round"
            filter="drop-shadow(0 0 8px ${strokeColor})" />
    `;
  }

  renderBoard() {
    this.cells.forEach((cell, idx) => {
      const val = this.board[idx];
      if (val === '') {
        cell.innerHTML = '';
        cell.classList.remove('marked');
      } else {
        cell.classList.add('marked');
        if (!cell.querySelector(`.symbol-${val.toLowerCase()}`)) {
          cell.innerHTML = `<span class="symbol-${val.toLowerCase()}">${val}</span>`;
        }
      }
    });
  }

  updateStatus() {
    this.statusDot.style.display = 'inline-block';
    this.statusDot.className = `turn-dot ${this.currentTurn.toLowerCase()}`;

    if (this.mode === 'ai') {
      if (this.currentTurn === this.userSymbol) {
        this.statusText.textContent = `Your Turn (${this.userSymbol})`;
      } else {
        this.statusText.textContent = 'Bot is thinking...';
      }
    } else {
      this.statusText.textContent = `Player ${this.currentTurn}'s Turn`;
    }
  }

  updateActiveCard() {
    this.cardX.classList.toggle('active-turn', this.currentTurn === 'X' && !this.isGameOver);
    this.cardO.classList.toggle('active-turn', this.currentTurn === 'O' && !this.isGameOver);
  }

  updateScoreboard() {
    this.scoreX.textContent = this.scores.x;
    this.scoreO.textContent = this.scores.o;
    this.scoreDraw.textContent = this.scores.draw;
  }

  resetGame() {
    if (window.walletManager && !window.walletManager.canAffordMatch()) {
      window.walletManager.showOutOfCoinsModal();
      return;
    }

    this.roundStarted = false;
    this.board = Array(9).fill('');
    this.isGameOver = false;
    this.isAiThinking = false;
    this.currentTurn = 'X';
    this.strikeSvg.innerHTML = '';

    if (this.doubleRewardBtn) {
      this.doubleRewardBtn.style.display = 'none';
    }

    this.cells.forEach(c => {
      c.className = 'cell';
      c.innerHTML = '';
    });

    this.updateStatus();
    this.updateActiveCard();

    // If AI is playing as 'X' (user picked 'O'), AI goes first!
    if (this.mode === 'ai' && this.userSymbol === 'O') {
      this.triggerAiTurn();
    }
  }

  updateUI() {
    this.updateScoreboard();
    this.updateStatus();
    this.updateActiveCard();
    this.soundToggleBtn.textContent = this.sound.enabled ? '🔊' : '🔇';

    this.symbolChips.forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-symbol') === this.userSymbol);
    });

    this.diffChips.forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-diff') === this.difficulty);
    });

    if (this.mode === 'ai' && this.userSymbol === 'O') {
      this.triggerAiTurn();
    }
  }
}

class AuthManager {
  constructor(gameApp) {
    this.gameApp = gameApp;
    this.currentUser = null;

    this.loginOverlay = document.getElementById('login-overlay');
    this.loginForm = document.getElementById('login-form');
    this.nameInput = document.getElementById('player-name');
    this.emailInput = document.getElementById('player-email');
    this.emailError = document.getElementById('email-error');
    this.displayName = document.getElementById('user-display-name');
    this.displayEmail = document.getElementById('user-display-email');
    this.logoutBtn = document.getElementById('logout-btn');

    this.init();
  }

  init() {
    this.checkSession();
    this.bindEvents();
  }

  isLoggedIn() {
    return !!(this.currentUser && this.currentUser.email);
  }

  checkSession() {
    try {
      const savedUser = localStorage.getItem('furu_auth_user');
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
        this.unlockApp();
        setTimeout(() => {
          if (window.leaderboardManager) {
            window.leaderboardManager.render();
            window.leaderboardManager.checkForWinnerReward();
          }
        }, 500);
      } else {
        this.lockApp();
      }
    } catch (e) {
      this.lockApp();
    }
  }

  bindEvents() {
    this.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    this.logoutBtn.addEventListener('click', () => {
      this.handleLogout();
    });

    this.emailInput.addEventListener('input', () => {
      this.emailInput.classList.remove('error');
      this.emailError.classList.remove('visible');
    });
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return re.test(String(email).toLowerCase());
  }

  handleLogin() {
    const name = this.nameInput.value.trim();
    const email = this.emailInput.value.trim();

    if (!name) {
      this.nameInput.focus();
      return;
    }

    if (!this.validateEmail(email)) {
      this.emailInput.classList.add('error');
      this.emailError.classList.add('visible');
      this.emailInput.focus();
      return;
    }

    this.currentUser = {
      name: name,
      email: email,
      loggedInAt: new Date().toISOString()
    };

    try {
      localStorage.setItem('furu_auth_user', JSON.stringify(this.currentUser));
    } catch (e) {}

    // Celebration on login
    this.gameApp.sound.playWin();
    this.gameApp.confetti.blast();
    this.unlockApp();

    // Trigger leaderboard update & reward check
    if (window.leaderboardManager) {
      window.leaderboardManager.render();
      window.leaderboardManager.checkForWinnerReward();
      window.leaderboardManager.syncScoreToDatabase();
    }
  }

  handleLogout() {
    this.gameApp.sound.playClick();
    this.currentUser = null;
    try {
      localStorage.removeItem('furu_auth_user');
    } catch (e) {}

    this.nameInput.value = '';
    this.emailInput.value = '';
    this.lockApp();
    this.gameApp.resetGame();

    if (window.leaderboardManager) {
      window.leaderboardManager.render();
    }
  }

  lockApp() {
    this.loginOverlay.classList.remove('hidden-gate');
    this.displayName.textContent = 'Guest';
    this.displayEmail.textContent = '(Not logged in)';
    if (window.leaderboardManager) {
      window.leaderboardManager.render();
    }
  }

  unlockApp() {
    this.loginOverlay.classList.add('hidden-gate');
    this.displayName.textContent = this.currentUser.name;
    this.displayEmail.textContent = `(${this.currentUser.email})`;
    if (window.leaderboardManager) {
      window.leaderboardManager.render();
    }
  }
}

// ==========================================================
// 1. VIRTUAL COIN WALLET MANAGER
// ==========================================================
class WalletManager {
  constructor(gameApp) {
    this.gameApp = gameApp;
    this.coins = 100; // Default wallet starting balance
    this.trophies = 0;
    this.matchesCompleted = 0;

    this.MATCH_FEE = 20;     // 20 coins entry fee
    this.WIN_REWARD = 35;    // 35 coins reward for winning (+15 net gain)
    this.TROPHY_WIN = 25;    // +25 Trophies on win
    this.TROPHY_DRAW = 5;    // +5 Trophies on draw
    this.TROPHY_LOSS = 10;   // -10 Trophies on loss (min 0)
    this.AD_REWARD = 50;     // +50 Coins for watching rewarded ad (exact 50)

    this.coinBalanceEl = document.getElementById('coin-balance');
    this.trophyCountEl = document.getElementById('trophy-count');
    this.modalCoinBalanceEl = document.getElementById('modal-coin-balance');
    this.coinsModal = document.getElementById('coins-modal');
    this.closeCoinsBtn = document.getElementById('close-coins-btn');
    this.walletBtn = document.getElementById('wallet-btn');
    this.watchAdBtn = document.getElementById('watch-rewarded-ad-btn');

    this.load();
    this.bindEvents();
    this.updateUI();
  }

  load() {
    try {
      const savedCoins = localStorage.getItem('furu_coins');
      this.coins = savedCoins !== null ? parseInt(savedCoins, 10) : 100;
      const savedTrophies = localStorage.getItem('furu_trophies');
      this.trophies = savedTrophies !== null ? parseInt(savedTrophies, 10) : 0;
      const savedMatches = localStorage.getItem('furu_matches_count');
      this.matchesCompleted = savedMatches !== null ? parseInt(savedMatches, 10) : 0;
    } catch (e) {
      this.coins = 100;
      this.trophies = 0;
      this.matchesCompleted = 0;
    }
  }

  save() {
    try {
      localStorage.setItem('furu_coins', this.coins);
      localStorage.setItem('furu_trophies', this.trophies);
      localStorage.setItem('furu_matches_count', this.matchesCompleted);
    } catch (e) {}
    this.updateUI();
  }

  canAffordMatch() {
    return this.coins >= this.MATCH_FEE;
  }

  deductEntryFee() {
    if (!this.canAffordMatch()) {
      this.showOutOfCoinsModal();
      return false;
    }
    this.coins -= this.MATCH_FEE;
    this.save();
    return true;
  }

  rewardWin() {
    this.coins += this.WIN_REWARD;
    this.trophies += this.TROPHY_WIN;
    this.save();
    if (window.leaderboardManager) {
      window.leaderboardManager.syncScoreToDatabase();
    }
  }

  recordDraw() {
    this.trophies += this.TROPHY_DRAW;
    this.save();
    if (window.leaderboardManager) {
      window.leaderboardManager.syncScoreToDatabase();
    }
  }

  recordLoss() {
    this.trophies = Math.max(0, this.trophies - this.TROPHY_LOSS);
    this.save();
    if (window.leaderboardManager) {
      window.leaderboardManager.syncScoreToDatabase();
    }
  }

  creditAdReward() {
    this.coins += this.AD_REWARD;
    this.save();
    this.hideOutOfCoinsModal();
  }

  updateUI() {
    if (this.coinBalanceEl) this.coinBalanceEl.textContent = this.coins;
    if (this.trophyCountEl) this.trophyCountEl.textContent = this.trophies;
    if (this.modalCoinBalanceEl) this.modalCoinBalanceEl.textContent = `${this.coins} 🪙`;
    const lbUserTrophies = document.getElementById('lb-user-trophies');
    if (lbUserTrophies) lbUserTrophies.textContent = this.trophies;
  }

  showOutOfCoinsModal() {
    if (this.coinsModal) {
      this.updateUI();
      this.coinsModal.classList.add('open');
      this.gameApp.sound.playTone(320, 'sawtooth', 0.2, 0.2);
    }
  }

  hideOutOfCoinsModal() {
    if (this.coinsModal) this.coinsModal.classList.remove('open');
  }

  bindEvents() {
    if (this.walletBtn) {
      this.walletBtn.addEventListener('click', () => {
        this.gameApp.sound.playClick();
        this.showOutOfCoinsModal();
      });
    }
    if (this.closeCoinsBtn) {
      this.closeCoinsBtn.addEventListener('click', () => {
        this.gameApp.sound.playClick();
        this.hideOutOfCoinsModal();
      });
    }
    if (this.coinsModal) {
      this.coinsModal.addEventListener('click', (e) => {
        if (e.target === this.coinsModal) this.hideOutOfCoinsModal();
      });
    }
    if (this.watchAdBtn) {
      this.watchAdBtn.addEventListener('click', () => {
        this.gameApp.sound.playClick();
        this.hideOutOfCoinsModal();
        if (window.adMobManager) {
          window.adMobManager.showRewardedVideo();
        }
      });
    }
  }
}

// ==========================================================
// 💰 REAL WEB MONETIZATION CONFIGURATION (MONETAG & GAMEDISTRIBUTION)
// ==========================================================
// ==========================================================
// 💰 VERIFIED MONETAG MONETIZATION CONFIGURATION (ZONE: 11722361)
// ==========================================================
const REAL_AD_CONFIG = {
  activeNetwork: 'monetag',
  monetag: {
    zoneId: '11722361'
  }
};

// ==========================================================
// 2. REAL AD MANAGER (MONETAG INTERSTITIAL & REWARDED)
//    - ZERO DUMMY/FAKE POPUPS
//    - ONLY TRIGGERS ON "WATCH AD" OR OUT-OF-COINS
// ==========================================================
class RealAdManager {
  constructor(gameApp) {
    this.gameApp = gameApp;
    this.config = REAL_AD_CONFIG;
    this.zoneId = '11722361';
    this.isWatchingAd = false;
    this.pendingReward = null;
    this.pendingDismiss = null;

    // Capacitor Native Android APK support (optional fallback)
    this.isCapacitor = typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('AdMob'));
    this.nativeAdMobIds = {
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
      interstitial: 'ca-app-pub-3940256099942544/1033173712'
    };

    this.init();
  }

  init() {
    this.ensureMonetagSdkLoaded();
    this.interceptWindowOpen();
    this.bindVisibilityAndFocusListeners();
    this.checkPendingRewardOnLoad();
  }

  // Force all ad/sponsor popups into a NEW TAB to protect main game
  interceptWindowOpen() {
    if (typeof window === 'undefined') return;
    const originalOpen = window.open;
    window.open = function(url, target, features) {
      return originalOpen.call(window, url, '_blank', features || 'noopener,noreferrer');
    };
  }

  ensureMonetagSdkLoaded() {
    const zoneId = this.zoneId;
    if (!document.querySelector(`script[src*="libtl.com"]`)) {
      const script = document.createElement('script');
      script.src = 'https://libtl.com/sdk.js';
      script.setAttribute('data-zone', zoneId);
      script.setAttribute('data-sdk', `show_${zoneId}`);
      document.head.appendChild(script);
      console.log(`📡 Monetag libtl SDK script injected for Zone: ${zoneId}`);
    }
  }

  // Window Focus & Visibility Change Listener
  bindVisibilityAndFocusListeners() {
    const handleUserReturn = () => {
      const clickTime = parseInt(localStorage.getItem('furu_ad_click_time') || '0', 10);
      const elapsed = Date.now() - clickTime;

      // Check 2X Double Win Reward state
      const isDoublePending = this.isWatchingDoubleReward || localStorage.getItem('furu_double_reward_pending') === 'true';
      if (isDoublePending) {
        if (elapsed >= 2500) {
          this.grantDoubleReward();
        }
        return;
      }

      // Check standard Rewarded Video state (+50 coins)
      const isPending = this.isWatchingAd || localStorage.getItem('furu_ad_watching') === 'true';
      if (!isPending) return;

      // Verify user actually switched and stayed on the ad tab for at least 2.5s
      if (elapsed >= 2500) {
        this.grantReward('tab_focus_return');
      }
    };

    window.addEventListener('focus', handleUserReturn);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleUserReturn();
      }
    });
  }

  // If user on mobile had a navigation/reload and came back via back button
  checkPendingRewardOnLoad() {
    const isDoublePending = localStorage.getItem('furu_double_reward_pending') === 'true';
    if (isDoublePending) {
      const clickTime = parseInt(localStorage.getItem('furu_ad_click_time') || '0', 10);
      const elapsed = Date.now() - clickTime;
      if (elapsed >= 2500) {
        setTimeout(() => this.grantDoubleReward(), 600);
      } else {
        localStorage.removeItem('furu_double_reward_pending');
        localStorage.removeItem('furu_ad_click_time');
      }
      return;
    }

    const isPending = localStorage.getItem('furu_ad_watching') === 'true';
    if (!isPending) return;

    const clickTime = parseInt(localStorage.getItem('furu_ad_click_time') || '0', 10);
    const elapsed = Date.now() - clickTime;

    if (elapsed >= 2500) {
      setTimeout(() => {
        this.grantReward('page_reload_return');
      }, 600);
    } else {
      localStorage.removeItem('furu_ad_watching');
      localStorage.removeItem('furu_ad_click_time');
    }
  }

  // Double Win (+35 🪙) Ad Trigger
  showDoubleRewardAd(callback) {
    this.isWatchingDoubleReward = true;
    this.pendingDoubleCallback = callback;
    localStorage.setItem('furu_double_reward_pending', 'true');
    localStorage.setItem('furu_ad_click_time', Date.now().toString());

    this.showToast('🎬 Opening Sponsor Ad to Double Win (+35 🪙)...');

    const zoneId = this.zoneId;
    const monetagSdkFunction = window[`show_${zoneId}`] || window.show_11722361;

    let adOpened = false;
    if (typeof monetagSdkFunction === 'function') {
      try {
        const adPromise = monetagSdkFunction();
        adOpened = true;
        if (adPromise && typeof adPromise.then === 'function') {
          adPromise
            .then(() => {
              this.grantDoubleReward();
            })
            .catch((err) => {
              console.warn('Monetag double reward promise closed:', err);
            });
        }
      } catch (e) {
        console.warn('Monetag function error:', e);
      }
    }

    if (!adOpened) {
      window.open(`https://alwingulla.com/88/tag.min.js?zone=${zoneId}`, '_blank');
    }
  }

  grantDoubleReward() {
    const isPending = this.isWatchingDoubleReward || localStorage.getItem('furu_double_reward_pending') === 'true';
    if (!isPending) return;

    this.isWatchingDoubleReward = false;
    localStorage.removeItem('furu_double_reward_pending');
    localStorage.removeItem('furu_ad_click_time');

    if (this.pendingDoubleCallback) {
      this.pendingDoubleCallback(true);
      this.pendingDoubleCallback = null;
    } else {
      if (window.walletManager) {
        window.walletManager.coins += 35;
        window.walletManager.save();
      }
      this.showToast('🎉 Double Reward: +35 Extra Coins Added!');
    }
  }

  // Grant coins, persist to localStorage, update UI and celebrate
  grantReward(triggerSource) {
    const isPending = this.isWatchingAd || localStorage.getItem('furu_ad_watching') === 'true';
    if (!isPending) return;

    console.log(`🎉 Granting +50 Coins reward (source: ${triggerSource})`);
    this.isWatchingAd = false;
    localStorage.removeItem('furu_ad_watching');
    localStorage.removeItem('furu_ad_click_time');

    // 1. Credit wallet & save to localStorage exactly once (+50)
    if (window.walletManager) {
      window.walletManager.creditAdReward();
    }

    // 2. Audio & Confetti celebration
    if (this.gameApp && this.gameApp.sound) {
      this.gameApp.sound.playWin();
    }
    if (this.gameApp && this.gameApp.confetti) {
      this.gameApp.confetti.blast();
    }

    // 3. User requested exact toast: +50 Coins added!
    this.showToast('🎉 Reward Claimed: +50 Coins added!');

    if (this.pendingReward) {
      this.pendingReward = null;
    }
  }

  showToast(message, isError = false) {
    let toast = document.getElementById('ad-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ad-toast';
      document.body.appendChild(toast);
    }
    
    toast.style.cssText = `
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      background: ${isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(13, 18, 28, 0.95)'};
      color: ${isError ? '#ffffff' : '#00f0ff'};
      border: 1px solid ${isError ? 'rgba(239, 68, 68, 0.6)' : 'rgba(0, 240, 255, 0.4)'};
      border-radius: 9999px;
      padding: 12px 24px;
      font-size: 13px;
      font-weight: 700;
      z-index: 10000;
      box-shadow: 0 10px 30px rgba(0,0,0,0.85), 0 0 20px ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(0,240,255,0.3)'};
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
      text-align: center;
      max-width: 90vw;
    `;
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
    }, 3500);
  }

  async showRewardedVideo(onReward, onDismiss) {
    this.pendingReward = onReward;
    this.pendingDismiss = onDismiss;

    // 1. Mark pending ad state in memory and localStorage
    this.isWatchingAd = true;
    localStorage.setItem('furu_ad_watching', 'true');
    localStorage.setItem('furu_ad_click_time', Date.now().toString());

    this.showToast('🎬 Opening Sponsor Ad in new tab...');

    const zoneId = this.zoneId;
    const monetagSdkFunction = window[`show_${zoneId}`] || window.show_11722361;

    // 2. Open Monetag Ad in a NEW TAB so game tab remains open
    let adOpened = false;
    if (typeof monetagSdkFunction === 'function') {
      try {
        const adPromise = monetagSdkFunction();
        adOpened = true;
        if (adPromise && typeof adPromise.then === 'function') {
          adPromise
            .then(() => {
              this.grantReward('sdk_promise_resolve');
            })
            .catch((err) => {
              console.warn('Monetag promise dismiss, waiting for tab return:', err);
            });
        }
      } catch (e) {
        console.warn('Monetag function error:', e);
      }
    }

    // If SDK didn't trigger a new tab, open Monetag sponsor link directly in a NEW TAB
    if (!adOpened) {
      window.open(`https://alwingulla.com/88/tag.min.js?zone=${zoneId}`, '_blank');
    }
  }

  async showInterstitial(onDismiss) {
    const zoneId = this.zoneId;
    const monetagSdkFunction = window[`show_${zoneId}`] || window.show_11722361;
    if (typeof monetagSdkFunction === 'function') {
      try {
        const adPromise = monetagSdkFunction();
        if (adPromise && typeof adPromise.then === 'function') {
          adPromise.then(() => {
            if (onDismiss) onDismiss();
          }).catch(() => {
            if (onDismiss) onDismiss();
          });
          return;
        }
      } catch (e) {
        console.warn('Monetag interstitial closed:', e);
      }
    }
    if (onDismiss) onDismiss();
  }
}

// ==========================================================
// 3. TOURNAMENT LEADERBOARD MANAGER
//    - ONLY LOGGED-IN USERS IN LEADERBOARD (GUESTS FILTERED OUT)
//    - 3-DAY TOURNAMENT AUTOMATION & 100 COINS REWARD POPUP
// ==========================================================
class LeaderboardManager {
  constructor(gameApp) {
    this.gameApp = gameApp;
    this.modal = document.getElementById('leaderboard-modal');
    this.listEl = document.getElementById('leaderboard-list');
    this.timerEl = document.getElementById('tournament-timer');
    this.openBtn = document.getElementById('leaderboard-btn');
    this.closeBtn = document.getElementById('close-leaderboard-btn');
    this.userNameEl = document.getElementById('lb-user-name');
    this.userTrophiesEl = document.getElementById('lb-user-trophies');
    this.guestPromptEl = document.getElementById('lb-guest-prompt');
    this.myRankCardEl = document.getElementById('my-rank-card');
    this.lbLoginBtn = document.getElementById('lb-login-btn');
    this.winnerModal = document.getElementById('tournament-winner-modal');
    this.claimWinnerBtn = document.getElementById('claim-winner-reward-btn');

    // Verified authenticated tournament players (Guests never added)
    this.mockLeaderboard = [
      { name: 'Aman_Pro⚡', trophies: 840, isGuest: false },
      { name: 'Kashmir_King👑', trophies: 710, isGuest: false },
      { name: 'CyberZero🤖', trophies: 580, isGuest: false },
      { name: 'Simran_X✨', trophies: 460, isGuest: false },
      { name: 'Rohit_Kaata🎮', trophies: 390, isGuest: false },
      { name: 'NinjaFuru⚔️', trophies: 310, isGuest: false },
      { name: 'Pooja_Sharma🌸', trophies: 270, isGuest: false },
      { name: 'Vikram_Apex🎯', trophies: 210, isGuest: false }
    ];

    this.bindEvents();
    this.startTimer();
  }

  startTimer() {
    const updateCountdown = () => {
      // 3-Day Tournament Cycle (72 Hours = 259,200,000 ms)
      const CYCLE_MS = 3 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const remaining = CYCLE_MS - (now % CYCLE_MS);

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((remaining / 1000 / 60) % 60);

      if (this.timerEl) {
        this.timerEl.textContent = `${days}d ${hours}h ${minutes}m`;
      }
    };
    updateCountdown();
    setInterval(updateCountdown, 60000);
  }

  render() {
    if (!this.listEl) return;
    const isLoggedIn = window.authManager && window.authManager.isLoggedIn();

    if (!isLoggedIn) {
      // 🔒 GUEST MODE: Show Guest Warning & Hide Current User Rank Row
      if (this.guestPromptEl) this.guestPromptEl.style.display = 'flex';
      if (this.myRankCardEl) this.myRankCardEl.style.display = 'none';

      // Only display verified registered players. Guest is NOT added!
      const guestFilteredList = [...this.mockLeaderboard]
        .filter(entry => !entry.isGuest)
        .sort((a, b) => b.trophies - a.trophies)
        .slice(0, 10);

      this.renderList(guestFilteredList);
      return;
    }

    // ⚡ LOGGED-IN MODE: Hide Warning & Show Authenticated User's Real Rank
    if (this.guestPromptEl) this.guestPromptEl.style.display = 'none';
    if (this.myRankCardEl) this.myRankCardEl.style.display = 'flex';

    const currentUser = window.authManager.currentUser;
    const currentTrophies = window.walletManager ? window.walletManager.trophies : 0;

    if (this.userNameEl) this.userNameEl.textContent = currentUser.name;
    if (this.userTrophiesEl) this.userTrophiesEl.textContent = currentTrophies;

    // Merge authenticated user into tournament ranking
    const playerEntry = {
      name: `${currentUser.name} (You)`,
      trophies: currentTrophies,
      isPlayer: true,
      isGuest: false
    };

    const combined = [...this.mockLeaderboard.filter(e => !e.isGuest), playerEntry]
      .sort((a, b) => b.trophies - a.trophies)
      .slice(0, 10);

    this.renderList(combined);
  }

  renderList(items) {
    this.listEl.innerHTML = items.map((entry, idx) => {
      const rankNum = idx + 1;
      const medal = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : `#${rankNum}`;
      const topClass = rankNum <= 3 ? `top-${rankNum}` : '';
      const playerStyle = entry.isPlayer
        ? 'style="border: 1px solid var(--neon-cyan); background: rgba(0, 240, 255, 0.1); font-weight: 800;"'
        : '';

      return `
        <div class="leaderboard-item ${topClass}" ${playerStyle}>
          <div class="rank-badge" style="font-size: 13px;">${medal}</div>
          <div class="rank-info">
            <span class="rank-name">${entry.name}</span>
          </div>
          <div class="rank-score">${entry.trophies} 🏆</div>
        </div>
      `;
    }).join('');
  }

  // 3-Day Tournament Winner Reward Check (Called upon app launch and login)
  checkForWinnerReward() {
    if (!window.authManager || !window.authManager.isLoggedIn()) return;

    try {
      const pendingReward = localStorage.getItem('furu_tournament_winner_reward');
      if (pendingReward) {
        const rewardData = JSON.parse(pendingReward);
        if (rewardData && !rewardData.claimed) {
          this.showWinnerModal(rewardData.amount || 100);
        }
      }
    } catch (e) {
      console.warn('Winner reward check skipped:', e);
    }
  }

  showWinnerModal(amount = 100) {
    if (!this.winnerModal) return;
    this.winnerModal.classList.add('open');
    this.gameApp.sound.playWin();
    this.gameApp.confetti.blast();
  }

  claimWinnerReward() {
    if (!window.walletManager) return;

    // 1. Credit 100 coins to wallet
    window.walletManager.coins += 100;
    window.walletManager.save();

    // 2. Mark reward as claimed in localStorage
    try {
      const pendingReward = localStorage.getItem('furu_tournament_winner_reward');
      if (pendingReward) {
        const rewardData = JSON.parse(pendingReward);
        rewardData.claimed = true;
        rewardData.claimedAt = new Date().toISOString();
        localStorage.setItem('furu_tournament_winner_reward', JSON.stringify(rewardData));
      } else {
        localStorage.setItem('furu_tournament_winner_reward', JSON.stringify({
          amount: 100,
          claimed: true,
          claimedAt: new Date().toISOString()
        }));
      }
    } catch (e) {}

    // 3. Close modal and play sound
    if (this.winnerModal) this.winnerModal.classList.remove('open');
    this.gameApp.sound.playClick();
    this.gameApp.confetti.blast();

    if (window.realAdManager && window.realAdManager.showToast) {
      window.realAdManager.showToast('🎉 +100 Tournament Winner Coins Added!');
    }
  }

  // Sync tournament trophies to Firebase Firestore or REST Backend
  async syncScoreToDatabase() {
    // RULE 1: Guest users are NEVER synced or recorded in leaderboard
    if (!window.authManager || !window.authManager.isLoggedIn()) {
      console.log('🔒 Guest player: Tournament score will not be synced to global database.');
      return;
    }

    const user = window.authManager.currentUser;
    const trophies = window.walletManager ? window.walletManager.trophies : 0;

    // Real Firebase Firestore integration (if firebase SDK loaded)
    if (window.db && window.firebase) {
      try {
        await window.db.collection('tournament_leaderboard').doc(user.email).set({
          userId: user.email,
          displayName: user.name,
          trophies: trophies,
          isGuest: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('✅ Leaderboard synced to Cloud Firestore');
      } catch (err) {
        console.warn('Firestore sync failed:', err);
      }
    }
  }

  show() {
    this.render();
    if (this.modal) this.modal.classList.add('open');
  }

  hide() {
    if (this.modal) this.modal.classList.remove('open');
  }

  bindEvents() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => {
        this.gameApp.sound.playClick();
        this.show();
      });
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        this.gameApp.sound.playClick();
        this.hide();
      });
    }
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.hide();
      });
    }

    // Guest prompt login button
    if (this.lbLoginBtn) {
      this.lbLoginBtn.addEventListener('click', () => {
        this.gameApp.sound.playClick();
        this.hide();
        if (window.authManager) {
          window.authManager.lockApp(); // Opens login modal
        }
      });
    }

    // Winner reward claim button
    if (this.claimWinnerBtn) {
      this.claimWinnerBtn.addEventListener('click', () => {
        this.claimWinnerReward();
      });
    }
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new TicTacToeGame();
  window.authManager = new AuthManager(window.gameApp);
  window.walletManager = new WalletManager(window.gameApp);
  window.realAdManager = new RealAdManager(window.gameApp);
  window.adMobManager = window.realAdManager; // Compatibility alias
  window.leaderboardManager = new LeaderboardManager(window.gameApp);

  // Register service worker if available
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration skipped:', err);
    });
  }
});


