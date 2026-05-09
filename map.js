const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE = 20;
const COLS = 2000;
const ROWS = 2000;

// canvas.width = 600;
// canvas.height = 400;

const camera = {
  x: 0,
  y: 0,
  width: canvas.width,
  height: canvas.height
}

// 0=floor, 1=wall, 2=cover, 3=speed, 4=spikes, 5=water
const COLORS = ["#23233a", "#444441", "#888780", "#639922", "#E24B4A", "#378ADD"];

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

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  camera.width = canvas.width;
  camera.height = canvas.height;
}

resizeCanvas();

window.addEventListener("resize", resizeCanvas);

function draw() {
  const startCol = Math.max(0, Math.floor(camera.x / TILE));
  const endCol = Math.min(COLS, Math.ceil((camera.x + camera.width) / TILE));

  const startRow = Math.max(0, Math.floor(camera.y / TILE));
  const endRow = Math.min(ROWS, Math.ceil((camera.y + camera.height) / TILE));

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
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

  ctx.beginPath();
  ctx.arc(
    AI.x + Math.cos(AI.angle) * 10,
    AI.y + Math.sin(AI.angle) * 10,
    3, 0, Math.PI * 2
  );

  ctx.fillStyle = "white";
  ctx.fill();

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

  PLAYER.x = Math.max(PLAYER.radius, Math.min(PLAYER.x, (COLS * TILE) - PLAYER.radius));
  PLAYER.y = Math.max(PLAYER.radius, Math.min(PLAYER.y, (ROWS * TILE) - PLAYER.radius));
}

// Add this to your updateCamera() in map.js
function updateCamera() {
  camera.x = PLAYER.x - camera.width / 2;
  camera.y = PLAYER.y - camera.height / 2;

  // Only clamp if the map is actually larger than the screen
  if (COLS * TILE > camera.width) {
    camera.x = Math.max(0, Math.min(camera.x, (COLS * TILE) - camera.width));
  } else {
    // Center the map horizontally
    camera.x = (COLS * TILE - camera.width) / 2;
  }

  if (ROWS * TILE > camera.height) {
    camera.y = Math.max(0, Math.min(camera.y, (ROWS * TILE) - camera.height));
  } else {
    // Center the map vertically
    camera.y = (ROWS * TILE - camera.height) / 2;
  }
}

function gameLoop() {
  updatePlayer();
  updateCamera();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  draw();
  drawZones(ctx);
  drawAI();
  drawPlayer();

  ctx.restore();

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