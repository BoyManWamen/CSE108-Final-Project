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

function gameLoop() {
  draw ();
  drawZones(ctx);
  drawAI ();
  AI.step();
  requestAnimationFrame(gameLoop);
}

initZones();
gameLoop();


window.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") {
    const types = ["color", "math", "sequence"];
    const type  = types[Math.floor(Math.random() * types.length)];
    Minigame.start("player", type);
  }
});