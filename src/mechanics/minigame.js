const MINIGAME_TIME = 30;

let cachedWords   = null;
let cachedPhrases = null;
let assetsReady   = false;

async function loadGameAssets() {
  try {
    const wordsRes = await fetch("assets/data/FourLetterwords.txt");
    cachedWords = (await wordsRes.text())
      .split("\n")
      .map(w => w.trim())
      .filter(w => w.length > 0);

    const phrasesRes = await fetch("assets/data/phrases.txt");
    cachedPhrases = (await phrasesRes.text())
      .split("\n")
      .map(w => w.trim())
      .filter(w => w.length > 0);

    assetsReady = true;

  } catch (e) {
    console.error("Failed to load game assets:", e);
  }
}

const Minigame = {

  // player state
  active: false,
  triggeredBy: null,
  type: null,
  answer: null,
  choices: null,
  timer: null,
  timeLeft: MINIGAME_TIME,

  // ai state
  aiActive: false,
  aiAnswer: null,
  aiChoices: null,
  aiType: null,

  promptHTML: "",
  choicesHTML: "",

  async start(triggeredBy, gameType) {
    if (triggeredBy === "player" && this.active) return;
    if (triggeredBy === "ai" && this.aiActive) {
      console.warn("AI game already active");
      return;
    }

    if (!assetsReady && (gameType === "blank" || gameType === "typing")) {
      await loadGameAssets();
      if (!assetsReady) {
        console.error("Failed to load assets");
        return;
      }
    }

    if (triggeredBy === "ai") {
      this.aiActive = true;
      this.aiType   = gameType;

      const tempGame = this.buildGameData(gameType);
      if (!tempGame) {
        console.warn("Failed to build AI game");
        this.aiActive = false;
        return;
      }

      this.aiAnswer  = tempGame.answer;
      this.aiChoices = tempGame.choices;

      setTimeout(() => {
        const typed = Math.random() < 0.7
          ? this.aiAnswer
          : this.aiAnswer.slice(0, -1);

        const aiWon =
          typed.trim().toLowerCase() === this.aiAnswer.trim().toLowerCase();

        this.finishAI(aiWon);
      }, 1500 + Math.random() * 2000);

      return;
    }

    // player game
    this.active      = true;
    this.triggeredBy = "player";
    this.type        = gameType;

    if (this.type === "color")        this.buildColorGame();
    else if (this.type === "math")    this.buildMathGame();
    else if (this.type === "blank")   await this.buildFillBlankGame();
    else if (this.type === "typing")  await this.buildTypingGame();

    this.showOverlay();
    this.startTimer();

    if (this.type === "typing") {
      setTimeout(() => this.setupTypingSubmit(), 50);
    }
  },

  // =====================================================
  // BUILD AI GAME DATA
  // =====================================================

  buildGameData(gameType) {
    if (gameType === "color") {
      const colors = [
        "#e74c3c", "#3498db", "#2ecc71",
        "#f1c40f", "#9b59b6", "#e67e22",
      ];
      const answer  = colors[Math.floor(Math.random() * colors.length)];
      const choices = colors
        .filter(c => c !== answer)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      choices.push(answer);
      return { answer, choices };
    }

    if (gameType === "math") {
      const ops = ["+", "-"];
      const op  = ops[Math.floor(Math.random() * ops.length)];
      let a, b, answer;

      if (op === "+") {
        a      = Math.floor(Math.random() * 10) + 1;
        b      = Math.floor(Math.random() * 10) + 1;
        answer = a + b;
      } else {
        a      = Math.floor(Math.random() * 10) + 5;
        b      = Math.floor(Math.random() * a)  + 1;
        answer = a - b;
      }

      const wrongs = new Set();
      while (wrongs.size < 3) {
        const offset = Math.floor(Math.random() * 5) + 1;
        const wrong  = answer + (Math.random() < 0.5 ? offset : -offset);
        if (wrong !== answer && wrong >= 0) wrongs.add(wrong);
      }

      return { answer, choices: [...wrongs, answer] };
    }

    if (gameType === "blank") {
      if (!cachedWords?.length) return null;

      const word   = cachedWords[Math.floor(Math.random() * cachedWords.length)];
      const blankI = Math.floor(Math.random() * word.length);
      const answer = word[blankI].toUpperCase();

      const wrongs = new Set();
      while (wrongs.size < 3) {
        const letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[
          Math.floor(Math.random() * 26)
        ];
        if (letter !== answer) wrongs.add(letter);
      }

      return { answer, choices: [...wrongs, answer] };
    }

    if (gameType === "typing") {
      if (!cachedPhrases?.length) return null;
      const answer = cachedPhrases[Math.floor(Math.random() * cachedPhrases.length)];
      return { answer, choices: null };
    }

    return null;
  },

  // =====================================================
  // AI FINISH
  // =====================================================

  finishAI(won) {
    this.aiActive = false;

    if (won) {
      Leaderboard.addWin("ai");
      showNotification("🤖 AI won a minigame!");
    } else {
      Leaderboard.addWin(socket.id);
      socket.emit("minigameWin", {
        id:   socket.id,
        name: sessionStorage.getItem("username") || "Player",
        wins: Leaderboard.scores[socket.id]?.wins || 0,
      });
      showNotification("🤖 AI lost a minigame!");
    }
  },

  // =====================================================
  // COLOR GAME
  // =====================================================

  buildColorGame() {
    const colors = [
      "#e74c3c", "#3498db", "#2ecc71",
      "#f1c40f", "#9b59b6", "#e67e22",
    ];

    this.answer = colors[Math.floor(Math.random() * colors.length)];

    this.choices = colors
      .filter(c => c !== this.answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .concat(this.answer)
      .sort(() => Math.random() - 0.5);

    this.promptHTML = `
      <p class="mg-prompt">Match this color!</p>
      <div class="mg-target" style="background:${this.answer}"></div>
    `;

    this.choicesHTML = this.choices.map(c => `
      <button class="mg-choice" style="background:${c}" data-value="${c}"></button>
    `).join("");
  },

  // =====================================================
  // MATH GAME
  // =====================================================

  buildMathGame() {
    const ops = ["+", "-"];
    const op  = ops[Math.floor(Math.random() * ops.length)];
    let a, b;

    if (op === "+") {
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
      this.answer = a + b;
    } else {
      a = Math.floor(Math.random() * 10) + 5;
      b = Math.floor(Math.random() * a)  + 1;
      this.answer = a - b;
    }

    this.question = `${a} ${op} ${b} = ?`;

    const wrongs = new Set();
    while (wrongs.size < 3) {
      const offset = Math.floor(Math.random() * 5) + 1;
      const wrong  = this.answer + (Math.random() < 0.5 ? offset : -offset);
      if (wrong !== this.answer && wrong >= 0) wrongs.add(wrong);
    }

    this.choices = [...wrongs, this.answer].sort(() => Math.random() - 0.5);

    this.promptHTML = `
      <p class="mg-prompt">Solve it!</p>
      <p class="mg-question">${this.question}</p>
    `;

    this.choicesHTML = this.choices.map(n => `
      <button class="mg-choice mg-number" data-value="${n}">${n}</button>
    `).join("");
  },

  // =====================================================
  // BLANK GAME
  // =====================================================

  async buildFillBlankGame() {
    if (!cachedWords?.length) {
      const res = await fetch("assets/data/FourLetterwords.txt");
      cachedWords = (await res.text())
        .split("\n")
        .map(w => w.trim())
        .filter(w => w.length > 0);
    }

    const word   = cachedWords[Math.floor(Math.random() * cachedWords.length)];
    const blankI = Math.floor(Math.random() * word.length);
    this.answer  = word[blankI].toUpperCase();

    const display = word
      .split("")
      .map((l, i) =>
        i === blankI
          ? `<span class="mg-blank">_</span>`
          : `<span class="mg-letter">${l.toUpperCase()}</span>`
      )
      .join("");

    const wrongs = new Set();
    while (wrongs.size < 3) {
      const letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[
        Math.floor(Math.random() * 26)
      ];
      if (letter !== this.answer) wrongs.add(letter);
    }

    this.choices = [...wrongs, this.answer].sort(() => Math.random() - 0.5);

    this.promptHTML = `
      <p class="mg-prompt">Fill in the missing letter!</p>
      <div class="mg-word-display">${display}</div>
    `;

    this.choicesHTML = this.choices.map(l => `
      <button class="mg-choice mg-letter-btn" data-value="${l}">${l}</button>
    `).join("");
  },

  // =====================================================
  // TYPING GAME
  // =====================================================

  async buildTypingGame() {
    if (!cachedPhrases?.length) {
      const res = await fetch("assets/data/phrases.txt");
      cachedPhrases = (await res.text())
        .split("\n")
        .map(w => w.trim())
        .filter(w => w.length > 0);
    }

    this.answer = cachedPhrases[Math.floor(Math.random() * cachedPhrases.length)];

    this.promptHTML = `
      <p class="mg-prompt">Type this phrase!</p>
      <p class="mg-typing-phrase">${this.answer}</p>
      <input
        class="mg-typing-input"
        id="typing-input"
        type="text"
        placeholder="Type here..."
        autocomplete="off" />
    `;

    this.choicesHTML = `
      <div style="grid-column: 1 / -1; width: 100%;">
        <button class="mg-submit-btn" id="typing-submit">Submit</button>
      </div>
    `;
  },

  setupTypingSubmit() {
    const submitBtn = document.getElementById("typing-submit");
    const input     = document.getElementById("typing-input");
    if (!submitBtn || !input) return;

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.resolve(input.value.trim());
      }
    });

    submitBtn.addEventListener("click", () => {
      this.resolve(input.value.trim());
    });

    setTimeout(() => input.focus(), 100);
  },

  // =====================================================
  // OVERLAY
  // =====================================================

  showOverlay() {
    let overlay = document.getElementById("minigame-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "minigame-overlay";
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div id="minigame-box">
        <div id="mg-timer">${MINIGAME_TIME}</div>
        ${this.promptHTML}
        <div id="mg-choices">${this.choicesHTML}</div>
        <p id="mg-result"></p>
      </div>
    `;

    overlay.style.display = "flex";

    overlay.querySelectorAll(".mg-choice").forEach(btn => {
      if (btn.id === "typing-submit") return;
      btn.addEventListener("click", () => {
        const val = isNaN(btn.dataset.value)
          ? btn.dataset.value
          : Number(btn.dataset.value);
        this.resolve(val);
      });
    });
  },

  // =====================================================
  // TIMER
  // =====================================================

  startTimer() {
    this.timeLeft = MINIGAME_TIME;
    this.timer = setInterval(() => {
      this.timeLeft--;
      const el = document.getElementById("mg-timer");
      if (el) el.textContent = this.timeLeft;
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.resolveTimeout();
      }
    }, 1000);
  },

  resolveTimeout() {
    if (!this.active) return;
    const el = document.getElementById("mg-result");
    if (el) el.textContent = "⏰ Time's up!";
    setTimeout(() => this.finish(false), 800);
  },

  resolve(picked) {
    if (!this.active) return;
    clearInterval(this.timer);

    const won = this.type === "typing"
      ? String(picked).trim().toLowerCase() === this.answer.trim().toLowerCase()
      : picked === this.answer;

    const el = document.getElementById("mg-result");
    if (el) el.textContent = won ? "✅ Correct!" : "❌ Wrong!";

    setTimeout(() => this.finish(won), 800);
  },

  finish(won) {
    this.active = false;
    clearInterval(this.timer);

    const overlay = document.getElementById("minigame-overlay");
    if (overlay) overlay.style.display = "none";

    if (won) {
      Leaderboard.addWin(socket.id);
      socket.emit("minigameWin", {
        id:   socket.id,
        name: sessionStorage.getItem("username") || "Player",
        wins: Leaderboard.scores[socket.id]?.wins || 0,
      });
      showNotification("🏆 You won the minigame!");
    } else {
      Leaderboard.addWin("ai");
      showNotification("🤖 AI won the minigame!");
    }
  },
};