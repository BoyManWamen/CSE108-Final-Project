const FLAGS = {
  red:  { x: 580, y: 170, homeX: 580, homeY: 170, carriedBy: null },
  blue: { x:  40, y: 170, homeX:  40, homeY: 170, carriedBy: null },
};

const AI = {
  x: 250,
  y: 250,

  team: "red",         
  state: "ATTACK",     

  angle: Math.random() * Math.PI * 2,
  targetAngle: Math.random() * Math.PI * 2,

  speed: 1.5,
  turnSpeed: 0.05,

  captureRadius: 16,    

  get enemyFlag()  { return this.team === "red" ? FLAGS.blue : FLAGS.red;  },
  get ownFlag()    { return this.team === "red" ? FLAGS.red  : FLAGS.blue; },
  get homeBase()   { return this.team === "red"
    ? { x: FLAGS.red.homeX,  y: FLAGS.red.homeY  }
    : { x: FLAGS.blue.homeX, y: FLAGS.blue.homeY }; },

  dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  },

  angleToward(target) {
    return Math.atan2(target.y - this.y, target.x - this.x);
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

  think() {
    const ownFlagStolen = this.ownFlag.carriedBy !== null;

    // 1. If carrying the flag → race home
    if (this.isCarryingFlag()) {
      this.state = "CARRY";
      this.targetAngle = this.angleToward(this.homeBase);
      return;
    }

    // 2. If our flag was stolen → go defend / chase the carrier
    if (ownFlagStolen) {
      this.state = "DEFEND";
      // Chase whoever stole our flag
      const thief = this.ownFlag.carriedBy;
      this.targetAngle = this.angleToward(thief);
      return;
    }

    // 3. Otherwise → attack the enemy flag
    this.state = "ATTACK";
    this.targetAngle = this.angleToward(this.enemyFlag);

    // small random wobble so multiple bots don't stack perfectly
    this.targetAngle += (Math.random() - 0.5) * 0.3;
  },

  move() {
    let diff = this.targetAngle - this.angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.angle += diff * this.turnSpeed;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
  },

  step() {
    this.think();
    this.move();
    this.updateFlagPosition();
    this.tryPickUpFlag();
    this.tryScoreFlag();
  },
};