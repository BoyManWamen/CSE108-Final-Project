const ZONE_COUNT      = 7;
const ZONE_RADIUS     = 16;
const ZONE_RESPAWN_MS = 3000;

const ZONE_TYPES = [
  { color: "#e74c3c", label: "Red Square"    },
  { color: "#3498db", label: "Blue Square"   },
  { color: "#2ecc71", label: "Green Square"  },
  { color: "#f1c40f", label: "Yellow Square" },
  { color: "#9b59b6", label: "Purple Square" },
];

const zones = [];

function randomZonePosition() {
  // avoid first 4 and last 4 cols (flag zones)
  const col = 4 + Math.floor(Math.random() * (COLS - 8));
  const row = 1 + Math.floor(Math.random() * (ROWS - 2));
  return {
    x: col * TILE + (Math.random() * TILE),  
    y: row * TILE + (Math.random() * TILE),
  };
}

function spawnZone() {
  const pos  = randomZonePosition();
  const type = ZONE_TYPES[Math.floor(Math.random() * ZONE_TYPES.length)]; 
  zones.push({
    x:      pos.x,
    y:      pos.y,
    color:  type.color,
    label:  type.label,
    active: true,
    pulseT: 0,
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
    const dist = Math.hypot(entity.x - zone.x, entity.y - zone.y);
    if (dist < ZONE_RADIUS + 8) {
      zone.active = false;
      onTrigger(zone);
      setTimeout(spawnZone, ZONE_RESPAWN_MS); 
    }
  });
}

