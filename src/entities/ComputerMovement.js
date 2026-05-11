const AI = {
  x: 200,
  y: 200,

  team: "red",
  state: "ROAM",

  targetX: COLS * TILE / 2,
  targetY: ROWS * TILE / 2,

  waypointX: null,
  waypointY: null,
  waypointRadius: 15,

  angle: 0,
  speed: 2,

  setWaypoint() {
    const range = 2000;
    this.waypointX = 10 + Math.random() * (COLS * TILE - 20);
    this.waypointY = 10 + Math.random() * (ROWS * TILE - 20);
  },

  think() {
  // find closest active zone
  let closestZone = null;
  let closestDist = Infinity;

  zones.forEach(zone => {
    if (!zone.active) return;
    const dist = Math.hypot(zone.x - this.x, zone.y - this.y);
    if (dist < closestDist) {
      closestDist = dist;
      closestZone = zone;
    }
  });

  if (closestZone) {
    // head straight for the closest zone
    this.targetX = closestZone.x;
    this.targetY = closestZone.y;
  } else {
    // no zones found — wander randomly
    const atWaypoint = this.waypointX === null ||
      Math.hypot(this.waypointX - this.x, this.waypointY - this.y) < this.waypointRadius;
    if (atWaypoint) this.setWaypoint();
    this.targetX = this.waypointX;
    this.targetY = this.waypointY;
  }
},

  move() {
    const dx   = this.targetX - this.x;
    const dy   = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }

    this.angle = Math.atan2(dy, dx);

    this.x = Math.max(10, Math.min(this.x, COLS * TILE - 10));
    this.y = Math.max(10, Math.min(this.y, ROWS * TILE - 10));
  },

  step() {
    this.think();
    this.move();
  },
};