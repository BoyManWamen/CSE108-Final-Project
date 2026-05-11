const ZONE_RADIUS       = 16;

const zones = [];

socket.on("zoneState", (serverZones) => {
  const pulseById = new Map(zones.map(zone => [zone.id, zone.pulseT || 0]));
  zones.splice(0, zones.length, ...serverZones.map(zone => ({
    ...zone,
    pulseT: pulseById.get(zone.id) || 0,
  })));
});

function drawZones(ctx) {
  zones.forEach(zone => {
    if (!zone.active) return;
    zone.pulseT += 0.05;
    ctx.fillStyle = zone.color + "66";
    ctx.fillRect(zone.x - ZONE_RADIUS - 4, zone.y - ZONE_RADIUS - 4,
                 (ZONE_RADIUS + 4) * 2, (ZONE_RADIUS + 4) * 2);
    ctx.fillStyle = zone.color;
    ctx.fillRect(zone.x - ZONE_RADIUS, zone.y - ZONE_RADIUS,
                 ZONE_RADIUS * 2, ZONE_RADIUS * 2);
  });
}

function checkZoneCollision(entity, onTrigger) {
  zones.forEach(zone => {
    if (!zone.active) return;
    if (Minigame.active && Minigame.triggeredBy === "player") return;
    if (Minigame.aiActive) return;
    const dist = Math.hypot(entity.x - zone.x, entity.y - zone.y);
    if (dist < ZONE_RADIUS + 8) {
      const wasActive = zone.active;
      zone.active = false;
      socket.emit("zoneTriggered", { zoneId: zone.id }, (accepted) => {
        if (accepted) {
          onTrigger(zone.gameType);
          return;
        }
        zone.active = wasActive;
      });
    }
  });
}