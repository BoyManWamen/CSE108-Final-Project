const AI = {
  x: 200,
  y: 200,
  team: "red",
  state: "ROAM",
  targetX: 200,
  targetY: 200,
  waypointX: null,
  waypointY: null,
  waypointRadius: 15,
  angle: 0,
  speed: 3,              
  hitZoneCooldown: 0,

  think() {
    if (this.hitZoneCooldown > 0) {
      this.hitZoneCooldown--;
      return;
    }

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
      this.targetX = closestZone.x;
      this.targetY = closestZone.y;
    } else {
      const atWaypoint = this.waypointX === null ||
        Math.hypot(this.waypointX - this.x, this.waypointY - this.y) < this.waypointRadius;
      if (atWaypoint) this.setWaypoint();
      this.targetX = this.waypointX;
      this.targetY = this.waypointY;
    }
  },

  setWaypoint() {
    let wx, wy;
    do {
      wx = 10 + Math.random() * (COLS * TILE - 20);
      wy = 10 + Math.random() * (ROWS * TILE - 20);
    } while (Math.hypot(wx - this.x, wy - this.y) < 300);
    this.waypointX = wx;
    this.waypointY = wy;
  },

  onHitZone() {
    this.hitZoneCooldown = 60; 
    this.setWaypoint();
    this.targetX = this.waypointX;
    this.targetY = this.waypointY;
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