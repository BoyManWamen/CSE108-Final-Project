const ZONE_COUNT      = 3 + Math.floor(Math.random() * 6);
const ZONE_RADIUS     = 16;
const ZONE_RESPAWN_MS = 3000;
const MIN_ZONE_DISTANCE = 80;

const ZONE_TYPES = [
  { color: "#e74c3c", label: "Red Square"    },
  { color: "#3498db", label: "Blue Square"   },
  { color: "#2ecc71", label: "Green Square"  },
  { color: "#f1c40f", label: "Yellow Square" },
  { color: "#9b59b6", label: "Purple Square" },
];

const zones = [];

function randomZonePosition() {
  // spawn within 800px of the player in any direction
  const range = 800;

  const x = PLAYER.x + (Math.random() - 0.5) * range * 2;
  const y = PLAYER.y + (Math.random() - 0.5) * range * 2;

  // clamp to map bounds
  return {
    x: Math.max(ZONE_RADIUS + 10, Math.min(x, COLS * TILE - ZONE_RADIUS - 10)),
    y: Math.max(ZONE_RADIUS + 10, Math.min(y, ROWS * TILE - ZONE_RADIUS - 10)),
  };
}

function isTooClose(x, y) {
  return zones.some(zone =>
    Math.hypot(zone.x - x, zone.y - y) < MIN_ZONE_DISTANCE
  );
}

function spawnZone() {
  // remove zones that are too far from player
  zones.forEach(zone => {
    if (Math.hypot(zone.x - PLAYER.x, zone.y - PLAYER.y) > 1200) {
      zone.active = false;
    }
  });

  // remove inactive zones from array
  zones.splice(0, zones.length, ...zones.filter(z => z.active));

  const pos  = randomZonePosition();
  const type = ZONE_TYPES[Math.floor(Math.random() * ZONE_TYPES.length)];

  const gameTypes = ["color", "math", "blank", "typing"];
  const gameType  = gameTypes[Math.floor(Math.random() * gameTypes.length)];

  let position;
  let attempts = 0;
  do {
    position = randomZonePosition();
    attempts++;
  } while (isTooClose(position.x, position.y) && attempts < 50);

  zones.push({
    x:        position.x,
    y:        position.y,
    color:    type.color,
    label:    type.label,
    gameType: gameType,
    active:   true,
    pulseT:   0,
  });
}

function initZones() {
  for (let i = 0; i < ZONE_COUNT; i++) spawnZone();
}

function drawZones(ctx) {
  zones.forEach(zone => {
    if (!zone.active) return;

    zone.pulseT += 0.05;

    // outer glow
    ctx.fillStyle = zone.color + "66";
    ctx.fillRect(
      zone.x - ZONE_RADIUS - 4,
      zone.y - ZONE_RADIUS - 4,
      (ZONE_RADIUS + 4) * 2,
      (ZONE_RADIUS + 4) * 2
    );

    // main square
    ctx.fillStyle = zone.color;
    ctx.fillRect(
      zone.x - ZONE_RADIUS,
      zone.y - ZONE_RADIUS,
      ZONE_RADIUS * 2,
      ZONE_RADIUS * 2
    );
  });
}

function checkZoneCollision(entity, onTrigger) {
  zones.forEach(zone => {
    if (!zone.active) return;
    if (Minigame.active) return;

    const dist = Math.hypot(entity.x - zone.x, entity.y - zone.y);
    if (dist < ZONE_RADIUS + 8) {
      zone.active = false;
      onTrigger(zone.gameType);
      setTimeout(spawnZone, ZONE_RESPAWN_MS);
    }
  });
}