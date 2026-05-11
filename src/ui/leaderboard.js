const Leaderboard = {
  scores:   {},
  aiWins:   0,
  timeLeft: 120,
  timer:    null,
  gameOver: false,

init() {
  const name = sessionStorage.getItem("username") || "Player";

  if (socket.connected) {
    this.scores[socket.id] = { name, wins: 0 };
    this.buildSidebar();
    this.startTimer(); 
    socket.on("connect", () => {
      this.scores[socket.id] = { name, wins: 0 };
      this.buildSidebar();
      this.startTimer(); 
    });
  }

  socket.on('syncTime', (timeLeft) => {
    clearInterval(this.timer);
    this.timeLeft = timeLeft;
    this.gameOver = false;
    this.startTimer();
  });
},

  addWin(who) {
    if (this.gameOver) return;
    if (who === "ai") {
      this.aiWins++;
    } else {
      if (!this.scores[who]) this.scores[who] = { name: "Player", wins: 0 };
      this.scores[who].wins++;
    }
    this.updateSidebar();
  },

  addPlayer(id, name) {
    if (id === socket.id) return;
    if (!this.scores[id]) this.scores[id] = { name: name || "Player", wins: 0 };
    this.updateSidebar();
  },

  removePlayer(id) { delete this.scores[id]; this.updateSidebar(); },

  startTimer() {
    this.timer = setInterval(() => {
      if (this.gameOver) return;
      this.timeLeft--;
      const el = document.getElementById("lb-timer");
      if (el) {
        const mins = Math.floor(this.timeLeft / 60);
        const secs = String(this.timeLeft % 60).padStart(2, "0");
        el.textContent = `${mins}:${secs}`;
      }
      if (this.timeLeft <= 0) { clearInterval(this.timer); this.showEndScreen(); }
    }, 1000);
  },

  buildSidebar() {
    let sidebar = document.getElementById("leaderboard-sidebar");
    if (!sidebar) {
      sidebar = document.createElement("div");
      sidebar.id = "leaderboard-sidebar";
      document.body.appendChild(sidebar);
    }
    this.updateSidebar();
  },

  updateSidebar() {
    const sidebar = document.getElementById("leaderboard-sidebar");
    if (!sidebar) return;
    const playerRows = Object.entries(this.scores)
      .sort((a, b) => b[1].wins - a[1].wins)
      .map(([id, data]) => {
        const isMe = id === socket.id;
        return `<div class="lb-row ${isMe ? "lb-me" : ""}">
          <span class="lb-name">${data.name}${isMe ? " (you)" : ""}</span>
          <span class="lb-score">${data.wins}</span>
        </div>`;
      }).join("");
    const mins = Math.floor(this.timeLeft / 60);
    const secs = String(this.timeLeft % 60).padStart(2, "0");
    sidebar.innerHTML = `
      <div id="lb-timer">${mins}:${secs}</div>
      <h3>🏆 Leaderboard</h3>
      ${playerRows}
      <div class="lb-row lb-ai">
        <span class="lb-name">🤖 AI</span>
        <span class="lb-score">${this.aiWins}</span>
      </div>`;
  },

  showEndScreen() {
    this.gameOver = true;
    let winnerName = "AI";
    let winnerWins = this.aiWins;
    Object.entries(this.scores).forEach(([id, data]) => {
      if (data.wins > winnerWins) { winnerName = data.name; winnerWins = data.wins; }
    });
    const allScores = Object.entries(this.scores)
      .sort((a, b) => b[1].wins - a[1].wins)
      .map(([id, data]) => `
        <div class="end-score-row">
          <span>${data.name}</span><span>${data.wins} wins</span>
        </div>`).join("");

    let screen = document.getElementById("end-screen");
    if (!screen) { screen = document.createElement("div"); screen.id = "end-screen"; document.body.appendChild(screen); }

    screen.innerHTML = `
      <div id="end-box">
        <h1>🏁 Time's Up!</h1>
        <p id="end-winner">🏆 ${winnerName} wins with ${winnerWins} wins!</p>
        <div class="end-scores">
          ${allScores}
          <div class="end-score-row"><span>🤖 AI</span><span>${this.aiWins} wins</span></div>
        </div>
        <button id="end-restart">Play Again</button>
      </div>`;
    screen.style.display = "flex";
    document.getElementById("end-restart").addEventListener("click", () => {
      screen.style.display = "none";
      clearInterval(this.timer);
      this.scores   = {};
      this.aiWins   = 0;
      this.gameOver = false;
      this.scores[socket.id] = { name: sessionStorage.getItem("username") || "Player", wins: 0 };
      this.updateSidebar();
      socket.emit('restartGame');
    });
  },
};