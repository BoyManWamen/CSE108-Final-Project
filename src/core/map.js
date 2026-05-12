const canvas = document.getElementById("gameCanvas");
const ctx    = canvas.getContext("2d");
const socket = io();

const _username    = sessionStorage.getItem("username") || "Player";
const otherPlayers = {};

let TILE = 20;
let COLS = 100;
let ROWS = 60;

const camera = {
  x: 0,
  y: 0,
  width:  canvas.width,
  height: canvas.height,
};

const COLORS = ["#23233a", "#444441", "#888780", "#639922", "#E24B4A", "#378ADD"];

let MAP = null;

const PLAYER = {
  x:          300,
  y:          120,
  radius:     8,
  speed:      2.4,
  lastDx:     0,
  lastDy:     1,
  team:       'blue',
  maxStamina: 100,
  stamina:    100,
  sprintMultiplier: 1.8,
  staminaDrain: 0.75,
  staminaRegen: 0.3,
};

const keys = { up: false, down: false, left: false, right: false, sprintRequested: false, sprint: false };

function resizeCanvas() {
  canvas.width    = window.innerWidth;
  canvas.height   = window.innerHeight;
  camera.width    = canvas.width;
  camera.height   = canvas.height;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

socket.on("mapConfig", (cfg) => {
  TILE = cfg.TILE;
  COLS = cfg.COLS;
  ROWS = cfg.ROWS;
  MAP  = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  AI.mapW = COLS * TILE;
  AI.mapH = ROWS * TILE;
});

socket.on("currentPlayers", (players) => {
  Object.keys(players).forEach((id) => {
    if (id !== socket.id) {
      otherPlayers[id] = players[id];
      if (typeof Leaderboard !== "undefined")
        Leaderboard.addPlayer(id, players[id].name || "Player");
    } else {
      PLAYER.team = players[id].team;
      PLAYER.x    = players[id].x;
      PLAYER.y    = players[id].y;
      if (typeof Leaderboard !== "undefined") {
        const name = sessionStorage.getItem("username") || "Player";
        Leaderboard.scores[socket.id] = { name, wins: 0 };
        Leaderboard.updateSidebar();
      }
    }
  });
});

socket.on("newPlayer", (playerInfo) => {
  otherPlayers[playerInfo.id] = playerInfo;
  if (typeof Leaderboard !== "undefined")
    Leaderboard.addPlayer(playerInfo.id, playerInfo.name || "Player");
});

socket.on("playerUpdated", (data) => {
  if (otherPlayers[data.id]) otherPlayers[data.id].name = data.name;
  if (typeof Leaderboard !== "undefined") {
    if (!Leaderboard.scores[data.id]) Leaderboard.scores[data.id] = { wins: 0 };
    Leaderboard.scores[data.id].name = data.name;
    Leaderboard.updateSidebar();
  }
});

socket.on("playerMoved", (playerInfo) => {
  if (!otherPlayers[playerInfo.id]) return;
  const p  = otherPlayers[playerInfo.id];
  p.x      = playerInfo.x;
  p.y      = playerInfo.y;
  p.lastDx = playerInfo.lastDx;
  p.lastDy = playerInfo.lastDy;
  p.name   = playerInfo.name;
});

socket.on("playerDisconnected", (playerId) => {
  delete otherPlayers[playerId];
  if (typeof Leaderboard !== "undefined")
    Leaderboard.removePlayer(playerId);
});

socket.on("scoreUpdate", (data) => {
  if (typeof Leaderboard === "undefined") return;
  if (!Leaderboard.scores[data.id]) Leaderboard.scores[data.id] = { wins: 0 };
  Leaderboard.scores[data.id].name = data.name;
  Leaderboard.scores[data.id].wins = data.wins;
  Leaderboard.updateSidebar();
});

socket.on("aiState", (data) => {
  AI.x = data.x; AI.y = data.y; AI.angle = data.angle; AI.team = data.team;
});

socket.on("aiMoved", (data) => {
  AI.x = data.x; AI.y = data.y; AI.angle = data.angle;
});

socket.on("aiMinigameResult", (data) => {
  if (data.won) {
    Leaderboard.addWin("ai");
    showNotification("🤖 AI won a minigame!");
  } else {
    showNotification("🤖 AI failed a minigame!");
  }
});

socket.on("gameOver", () => {
  if (typeof Leaderboard !== "undefined") Leaderboard.showEndScreen();
});

socket.on("gameRestarted", () => {
  const screen = document.getElementById("end-screen");
  if (screen) screen.style.display = "none";
  if (typeof Leaderboard !== "undefined") {
    Leaderboard.scores = {};
    Leaderboard.aiWins = 0;
    Leaderboard.gameOver = false;
    Leaderboard.scores[socket.id] = {
      name: sessionStorage.getItem("username") || "Player",
      wins: 0,
    };
    Leaderboard.updateSidebar();
  }
});

socket.on("scoresReset", () => {
  if (typeof Leaderboard !== "undefined") {
    Object.keys(Leaderboard.scores).forEach(id => {
      Leaderboard.scores[id].wins = 0;
    });
    Leaderboard.aiWins = 0;
    Leaderboard.updateSidebar();
  }
});

function draw() {
  if (!MAP) return;

  const startCol = Math.max(0, Math.floor(camera.x / TILE));
  const endCol   = Math.min(COLS, Math.ceil((camera.x + camera.width)  / TILE));
  const startRow = Math.max(0, Math.floor(camera.y / TILE));
  const endRow   = Math.min(ROWS, Math.ceil((camera.y + camera.height) / TILE));

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      ctx.fillStyle = COLORS[MAP[r][c]];
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
  }

  ctx.fillStyle   = "rgba(55,138,221,0.2)";
  ctx.fillRect(0, 0, 3 * TILE, ROWS * TILE);
  ctx.strokeStyle = "#378ADD";
  ctx.lineWidth   = 2;
  ctx.strokeRect(1, 1, 3 * TILE - 2, ROWS * TILE - 2);

  ctx.fillStyle   = "rgba(226,75,74,0.2)";
  ctx.fillRect((COLS - 3) * TILE, 0, 3 * TILE, ROWS * TILE);
  ctx.strokeStyle = "#E24B4A";
  ctx.strokeRect((COLS - 3) * TILE + 1, 1, 3 * TILE - 2, ROWS * TILE - 2);

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(Math.floor(COLS / 2) * TILE + TILE / 2, 0);
  ctx.lineTo(Math.floor(COLS / 2) * TILE + TILE / 2, ROWS * TILE);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawAI() {
  ctx.beginPath();
  ctx.arc(AI.x, AI.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = AI.team === "red" ? "#E24B4A" : "#378ADD";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(AI.x + Math.cos(AI.angle) * 10, AI.y + Math.sin(AI.angle) * 10, 3, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font      = "10px monospace";
  ctx.fillText("🤖 AI", AI.x + 12, AI.y - 8);
}

function drawPlayer() {
  ctx.beginPath();
  ctx.arc(PLAYER.x, PLAYER.y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fillStyle   = "#f7bf4f";
  ctx.fill();
  ctx.lineWidth   = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(PLAYER.x + PLAYER.lastDx * 10, PLAYER.y + PLAYER.lastDy * 10, 3, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font      = "10px monospace";
  ctx.fillText(_username, PLAYER.x + 12, PLAYER.y - 8);

  const barW = 40;
  const barH = 6;
  const barX = PLAYER.x - barW / 2;
  const barY = PLAYER.y - PLAYER.radius - 16;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  const pct = Math.max(0, Math.min(1, PLAYER.stamina / PLAYER.maxStamina));
  ctx.fillStyle = "#7bd389";
  ctx.fillRect(barX, barY, barW * pct, barH);
}

function drawOtherPlayers() {
  Object.values(otherPlayers).forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius || 8, 0, Math.PI * 2);
    ctx.fillStyle   = p.team === "red" ? "#E24B4A" : "#378ADD";
    ctx.fill();
    ctx.lineWidth   = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font      = "10px monospace";
    ctx.fillText(p.name || "Player", p.x + 12, p.y - 8);
  });
}

function updatePlayer() {
  let dx = 0, dy = 0;
  if (keys.left)  dx -= 1;
  if (keys.right) dx += 1;
  if (keys.up)    dy -= 1;
  if (keys.down)  dy += 1;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    if (!keys.sprint && keys.sprintRequested && PLAYER.stamina >= PLAYER.maxStamina) {
      keys.sprint = true;
    }

    let curSpeed = PLAYER.speed;
    if (keys.sprint && PLAYER.stamina > 0) {
      curSpeed *= PLAYER.sprintMultiplier;
      PLAYER.stamina = Math.max(0, PLAYER.stamina - PLAYER.staminaDrain);
      if (PLAYER.stamina === 0) keys.sprint = false;
    } else {
      PLAYER.stamina = Math.min(PLAYER.maxStamina, PLAYER.stamina + PLAYER.staminaRegen);
    }

    PLAYER.x     += dx * curSpeed;
    PLAYER.y     += dy * curSpeed;
    PLAYER.lastDx = dx;
    PLAYER.lastDy = dy;
    socket.emit("playerMovement", {
      x: PLAYER.x, y: PLAYER.y, lastDx: PLAYER.lastDx, lastDy: PLAYER.lastDy,
    });
  }

  if (dx === 0 && dy === 0 && !keys.sprint) {
    PLAYER.stamina = Math.min(PLAYER.maxStamina, PLAYER.stamina + PLAYER.staminaRegen);
  }

  const mapW = COLS * TILE;
  const mapH = ROWS * TILE;
  PLAYER.x = Math.max(PLAYER.radius, Math.min(PLAYER.x, mapW - PLAYER.radius));
  PLAYER.y = Math.max(PLAYER.radius, Math.min(PLAYER.y, mapH - PLAYER.radius));
}

function updateCamera() {
  const mapW = COLS * TILE;
  const mapH = ROWS * TILE;

  camera.x = PLAYER.x - camera.width  / 2;
  camera.y = PLAYER.y - camera.height / 2;

  if (mapW > camera.width) {
    camera.x = Math.max(0, Math.min(camera.x, mapW - camera.width));
  } else {
    camera.x = (mapW - camera.width) / 2;
  }

  if (mapH > camera.height) {
    camera.y = Math.max(0, Math.min(camera.y, mapH - camera.height));
  } else {
    camera.y = (mapH - camera.height) / 2;
  }
}

function gameLoop() {
  updatePlayer();
  updateCamera();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  draw();
  if (typeof drawZones === "function") drawZones(ctx);
  drawAI();
  drawPlayer();
  drawOtherPlayers();

  ctx.restore();

  if (typeof checkZoneCollision === "function") {
    checkZoneCollision(PLAYER, (gameType) => Minigame.start("player", gameType));
  }

  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  if (document.activeElement?.id === "typing-input") return;
  const key = e.key.toLowerCase();
  if (key === "arrowup"    || key === "w") { keys.up    = true; e.preventDefault(); }
  if (key === "arrowdown"  || key === "s") { keys.down  = true; e.preventDefault(); }
  if (key === "arrowleft"  || key === "a") { keys.left  = true; e.preventDefault(); }
  if (key === "arrowright" || key === "d") { keys.right = true; e.preventDefault(); }
  if (key === "shift") { keys.sprintRequested = true; if (PLAYER.stamina >= PLAYER.maxStamina) keys.sprint = true; e.preventDefault(); }
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key === "arrowup"    || key === "w") keys.up    = false;
  if (key === "arrowdown"  || key === "s") keys.down  = false;
  if (key === "arrowleft"  || key === "a") keys.left  = false;
  if (key === "arrowright" || key === "d") keys.right = false;
  if (key === "shift") { keys.sprintRequested = false; keys.sprint = false; }
});

function showNotification(msg) {
  let el = document.getElementById("game-notification");
  if (!el) {
    el = document.createElement("div");
    el.id = "game-notification";
    Object.assign(el.style, {
      position:     "fixed",
      bottom:       "30px",
      left:         "50%",
      transform:    "translateX(-50%)",
      background:   "rgba(0,0,0,0.75)",
      color:        "white",
      padding:      "10px 20px",
      borderRadius: "8px",
      fontFamily:   "monospace",
      fontSize:     "16px",
      transition:   "opacity 0.5s",
      zIndex:       "99",
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.style.opacity = "0"; }, 2500);
}

window.addEventListener("load", () => {
  Leaderboard.init();
  gameLoop();
  socket.emit("setUsername", _username);
});