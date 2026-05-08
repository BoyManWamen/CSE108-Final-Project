const MINIGAME_TIME = 30; 

const Minigame = {  
  active:      false,
  triggeredBy: null,
  type:        null,
  answer:      null,
  timer:       null,
  timeLeft:    MINIGAME_TIME,

  start(triggeredBy, gameType) {  
    this.active      = true;
    this.triggeredBy = triggeredBy;  
    this.type = gameType;
    
    if (this.type === "color") this.buildColorGame();
    else if (this.type === "math") this.buildMathGame();
    else if (this.type === "sequence") this.buildSequenceGame();
    this.showOverlay();
    this.startTimer();

    if (triggeredBy === "ai") {
      setTimeout(() => {
        if (!this.active) return;
        const aiWins = Math.random() < 0.6;
        this.resolve(aiWins ? this.answer : this.getWrongAnswer());
      }, 2000);
    }
  },
// MatchingColor Game
  buildColorGame() {
    const colors = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22"];
    this.answer  = colors[Math.floor(Math.random() * colors.length)];

    const others = colors
      .filter(c => c !== this.answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    this.choices     = [...others, this.answer].sort(() => Math.random() - 0.5);
    this.promptHTML  = `<p class="mg-prompt">Match this color!</p>
                        <div class="mg-target" style="background:${this.answer}"></div>`;
    this.choicesHTML = this.choices.map(c =>
      `<button class="mg-choice" style="background:${c}" data-value="${c}"></button>`
    ).join("");
  },
//Simple Math Sovler
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
      b = Math.floor(Math.random() * a) + 1;
      this.answer = a - b;
    }

    this.question = `${a} ${op} ${b} = ?`;

    const wrongs = new Set();
    while (wrongs.size < 3) {
      const offset = Math.floor(Math.random() * 5) + 1;
      const wrong  = this.answer + (Math.random() < 0.5 ? offset : -offset);
      if (wrong !== this.answer && wrong >= 0) wrongs.add(wrong);
    }

    this.choices     = [...wrongs, this.answer].sort(() => Math.random() - 0.5);
    this.promptHTML  = `<p class="mg-prompt">Solve it!</p>
                        <p class="mg-question">${this.question}</p>`;
    this.choicesHTML = this.choices.map(n =>
      `<button class="mg-choice mg-number" data-value="${n}">${n}</button>`
    ).join("");
  },


//   buildFillinTheBlank() {
//     const 
//   },

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
      btn.addEventListener("click", () => {
        const val = isNaN(btn.dataset.value)
          ? btn.dataset.value
          : Number(btn.dataset.value);
        this.resolve(val);
      });
    });
  },

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
    const won = picked === this.answer;
    const el  = document.getElementById("mg-result");
    if (el) el.textContent = won ? "✅ Correct!" : "❌ Wrong!";
    setTimeout(() => this.finish(won), 800);
  },

  finish(won) {
    this.active = false;
    const overlay = document.getElementById("minigame-overlay");
    if (overlay) overlay.style.display = "none";

    if (this.triggeredBy === "player") {
      won ? freezeAI() : freezePlayer();
    } else {
      won ? freezePlayer() : freezeAI();
    }
  },
};