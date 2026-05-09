const FLAGS = {
  red:  { x: 580, y: 170, homeX: 580, homeY: 170, carriedBy: null },
  blue: { x:  40, y: 170, homeX:  40, homeY: 170, carriedBy: null },
};

const AI = {
  x: 250,
  y: 250,

  team: "red",
  state: "ATTACK",

  targetX: 250,
  targetY: 250,

  waypointX: null,
  waypointY: null,
  waypointRadius: 20,

  angle: 0,
  speed: 1.5,
  captureRadius: 16,

  get enemyFlag()  { return this.team === "red" ? FLAGS.blue : FLAGS.red; },
  get ownFlag()    { return this.team === "red" ? FLAGS.red  : FLAGS.blue; },
  get homeBase()   { return this.team === "red"
    ? { x: FLAGS.red.homeX,  y: FLAGS.red.homeY  }
    : { x: FLAGS.blue.homeX, y: FLAGS.blue.homeY }; },

  dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  },

  isCarryingFlag() {
    return this.enemyFlag.carriedBy === this;
  },

  tryPickUpFlag() {
    const flag = this.enemyFlag;
    if (flag.carriedBy) return;
    if (this.dist(this, flag) < this.captureRadius) {
      flag.carriedBy = this;
    }
  },

  tryScoreFlag() {
    if (!this.isCarryingFlag()) return;
    if (this.dist(this, this.homeBase) < this.captureRadius) {
      console.log(`${this.team} AI scored!`);
      this.enemyFlag.x         = this.enemyFlag.homeX;
      this.enemyFlag.y         = this.enemyFlag.homeY;
      this.enemyFlag.carriedBy = null;
    }
  },

  updateFlagPosition() {
    if (this.isCarryingFlag()) {
      this.enemyFlag.x = this.x;
      this.enemyFlag.y = this.y;
    }
  },

  setWaypoint(goalX, goalY) {
    const midX = (this.x + goalX) / 2;
    const midY = (this.y + goalY) / 2;

    this.waypointX = midX + (Math.random() - 0.5) * 200;
    this.waypointY = midY + (Math.random() - 0.5) * 200;

    this.waypointX = Math.max(10, Math.min(this.waypointX, COLS * TILE - 10));
    this.waypointY = Math.max(10, Math.min(this.waypointY, ROWS * TILE - 10));
  },

  think() {
    const ownFlagStolen = this.ownFlag.carriedBy !== null;

    let goalX, goalY;

    if (this.isCarryingFlag()) {
      this.state = "CARRY";
      goalX = this.homeBase.x;
      goalY = this.homeBase.y;
    } else if (ownFlagStolen) {
      this.state = "DEFEND";
      goalX = this.ownFlag.carriedBy.x;
      goalY = this.ownFlag.carriedBy.y;
    } else {
      this.state = "ATTACK";
      goalX = this.enemyFlag.x;
      goalY = this.enemyFlag.y;
    }

    const atWaypoint = this.waypointX === null ||
      Math.hypot(this.waypointX - this.x, this.waypointY - this.y) < this.waypointRadius;

    if (atWaypoint) {
      this.setWaypoint(goalX, goalY);
    }

    this.targetX = this.waypointX;
    this.targetY = this.waypointY;
  },

  move() {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }

    this.angle = Math.atan2(dy, dx);
  },

  step() {
    this.think();
    this.move();
    this.updateFlagPosition();
    this.tryPickUpFlag();
    this.tryScoreFlag();
  },
};