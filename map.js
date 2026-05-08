const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE = 20;
const COLS = 31;
const ROWS = 18;

canvas.width  = COLS * TILE;
canvas.height = ROWS * TILE;

// 0=floor, 1=wall, 2=cover, 3=speed, 4=spikes, 5=water
const COLORS = ["#23233a","#444441","#888780","#639922","#E24B4A","#378ADD"];

const MAP = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const PLAYER = {
  x: 60,
  y: 120,
  radius: 8,
  speed: 2.4,
  lastDx: 0,
  lastDy: 1,
};

const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
};

function draw() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = COLORS[MAP[r][c]];
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
  }

  // Blue flag zone
  ctx.fillStyle = "rgba(55,138,221,0.2)";
  ctx.fillRect(0, 0, 3 * TILE, ROWS * TILE);
  ctx.strokeStyle = "#378ADD";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 3 * TILE - 2, ROWS * TILE - 2);

  // Red flag zone
  ctx.fillStyle = "rgba(226,75,74,0.2)";
  ctx.fillRect((COLS - 3) * TILE, 0, 3 * TILE, ROWS * TILE);
  ctx.strokeStyle = "#E24B4A";
  ctx.strokeRect((COLS - 3) * TILE + 1, 1, 3 * TILE - 2, ROWS * TILE - 2);

  // Center line
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.floor(COLS / 2) * TILE + TILE / 2, 0);
  ctx.lineTo(Math.floor(COLS / 2) * TILE + TILE / 2, ROWS * TILE);
  ctx.stroke();
  ctx.setLineDash([]);
}


// Drawing the AI onto the map
function drawAI() {
  ctx.beginPath();
  ctx.arc(AI.x, AI.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = AI.team === "red" ? "#E24B4A" : "#378ADD";
  ctx.fill();

  ctx.beginPath ();
  ctx.arc (
    AI.x + Math.cos(AI.angle) * 10,
    AI.y + Math.sin(AI.angle) * 10,
    3, 0, Math.PI * 2
  );

  ctx.fillStyle = "white";
  ctx. fill();

  ctx.fillStyle = "white";
  ctx.font = "10px monospace";
  ctx.fillText(AI.state, AI.x + 12, AI.y - 8);
}

function drawPlayer() {
  ctx.beginPath();
  ctx.arc(PLAYER.x, PLAYER.y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#f7bf4f";
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(
    PLAYER.x + PLAYER.lastDx * 10,
    PLAYER.y + PLAYER.lastDy * 10,
    3,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "white";
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "10px monospace";
  ctx.fillText("YOU", PLAYER.x + 12, PLAYER.y - 8);
}

function updatePlayer() {
  let dx = 0;
  let dy = 0;

  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;

    PLAYER.x += dx * PLAYER.speed;
    PLAYER.y += dy * PLAYER.speed;
    PLAYER.lastDx = dx;
    PLAYER.lastDy = dy;
  }

  PLAYER.x = Math.max(PLAYER.radius, Math.min(PLAYER.x, canvas.width - PLAYER.radius));
  PLAYER.y = Math.max(PLAYER.radius, Math.min(PLAYER.y, canvas.height - PLAYER.radius));
}

function gameLoop() {
  updatePlayer();
  draw ();
  drawZones(ctx);
  drawAI ();
  drawPlayer();
  AI.step();
  requestAnimationFrame(gameLoop);
}

initZones();
gameLoop();


window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === "arrowup" || key === "w") {
    keys.up = true;
    e.preventDefault();
  }
  if (key === "arrowdown" || key === "s") {
    keys.down = true;
    e.preventDefault();
  }
  if (key === "arrowleft" || key === "a") {
    keys.left = true;
    e.preventDefault();
  }
  if (key === "arrowright" || key === "d") {
    keys.right = true;
    e.preventDefault();
  }

  if (key === "m") {
    const types = ["color", "math", "sequence"];
    const type = types[Math.floor(Math.random() * types.length)];
    Minigame.start("player", type);
  }
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();

  if (key === "arrowup" || key === "w") keys.up = false;
  if (key === "arrowdown" || key === "s") keys.down = false;
  if (key === "arrowleft" || key === "a") keys.left = false;
  if (key === "arrowright" || key === "d") keys.right = false;
});