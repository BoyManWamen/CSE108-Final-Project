// ─── Database Setup (IndexedDB) ───────────────────────────────────────────────

const DB_NAME    = "ctf_users";
const DB_VERSION = 1;
let   db         = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains("users")) {
        const store = database.createObjectStore("users", { keyPath: "username" });
        store.createIndex("email", "email", { unique: true });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function getDB() {
  if (!db) db = await openDB();
  return db;
}

// ─── Crypto Helpers (PBKDF2 via Web Crypto API) ───────────────────────────────

const HASH_ALGO      = "SHA-256";
const PBKDF2_ALGO    = "PBKDF2";
const PBKDF2_ITERS   = 200_000;
const SALT_BYTES     = 16;

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

async function hashPassword(plaintext) {
  const saltBuf  = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const saltHex  = bufToHex(saltBuf);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plaintext),
    { name: PBKDF2_ALGO },
    false,
    ["deriveBits"]
  );

  const hashBuf = await crypto.subtle.deriveBits(
    { name: PBKDF2_ALGO, hash: HASH_ALGO, salt: saltBuf, iterations: PBKDF2_ITERS },
    keyMaterial,
    256
  );

  return saltHex + ":" + bufToHex(hashBuf);
}

async function verifyPassword(plaintext, stored) {
  const [saltHex, hashHex] = stored.split(":");
  const saltBuf = hexToBuf(saltHex);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plaintext),
    { name: PBKDF2_ALGO },
    false,
    ["deriveBits"]
  );

  const hashBuf = await crypto.subtle.deriveBits(
    { name: PBKDF2_ALGO, hash: HASH_ALGO, salt: saltBuf, iterations: PBKDF2_ITERS },
    keyMaterial,
    256
  );

  return bufToHex(hashBuf) === hashHex;
}

// ─── DB Operations ─────────────────────────────────────────────────────────────

function dbGetUser(username) {
  return new Promise(async (resolve, reject) => {
    const database = await getDB();
    const tx  = database.transaction("users", "readonly");
    const req = tx.objectStore("users").get(username);
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbAddUser(user) {
  return new Promise(async (resolve, reject) => {
    const database = await getDB();
    const tx  = database.transaction("users", "readwrite");
    const req = tx.objectStore("users").add(user);
    req.onsuccess = () => resolve(true);
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ─── UI Helpers ────────────────────────────────────────────────────────────────

function showError(msg) {
  document.getElementById("auth-error").textContent   = msg;
  document.getElementById("auth-success").textContent = "";
}

function showSuccess(msg) {
  document.getElementById("auth-success").textContent = msg;
  document.getElementById("auth-error").textContent   = "";
}

function setLoading(on) {
  const btn = document.getElementById("auth-btn");
  btn.disabled    = on;
  btn.textContent = on
    ? (isRegister ? "Registering…" : "Logging in…")
    : (isRegister ? "Register" : "Login");
}

// ─── Auth Logic ────────────────────────────────────────────────────────────────

async function login() {
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;

  if (!username || !password) { showError("Please fill in all fields."); return; }

  setLoading(true);
  try {
    const user = await dbGetUser(username);
    if (!user) { showError("Username not found."); return; }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) { showError("Incorrect password."); return; }

    sessionStorage.setItem("loggedIn", "true");
    sessionStorage.setItem("username", username);
    showSuccess(`Welcome back, ${username}! Loading…`);
    setTimeout(() => window.location.href = "index.html", 800);

  } catch (err) {
    showError("Something went wrong. Please try again.");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

async function register() {
  const username = document.getElementById("auth-username").value.trim();
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  if (!username || !email || !password) { showError("Please fill in all fields."); return; }
  if (password.length < 6)              { showError("Password must be at least 6 characters."); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError("Invalid email address."); return; }

  setLoading(true);
  try {
    const existing = await dbGetUser(username);
    if (existing) { showError("Username already taken."); return; }

    const passwordHash = await hashPassword(password);
    await dbAddUser({ username, email, passwordHash, createdAt: Date.now() });

    showSuccess("Account created! You can now log in.");
    setTimeout(toggleForm, 1200);

  } catch (err) {
    showError("Registration failed. Please try again.");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// ─── Form Toggle ───────────────────────────────────────────────────────────────

let isRegister = false;

function toggleForm() {
  isRegister = !isRegister;

  document.getElementById("auth-title").textContent    = isRegister ? "Create Account" : "Welcome Back";
  document.getElementById("auth-subtitle").textContent = isRegister ? "Register to play" : "Login to play";
  document.getElementById("auth-btn").textContent      = isRegister ? "Register" : "Login";
  document.getElementById("email-group").style.display = isRegister ? "block" : "none";
  document.getElementById("auth-switch").textContent   = isRegister
    ? "Already have an account? Login"
    : "Don't have an account? Register";

  // Clear messages on switch
  showError("");
  showSuccess("");
}

// ─── Event Listeners ───────────────────────────────────────────────────────────

document.getElementById("auth-btn").addEventListener("click", () => {
  isRegister ? register() : login();
});

document.getElementById("auth-switch").addEventListener("click", toggleForm);

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") isRegister ? register() : login();
});

// Init DB on page load
getDB().catch(console.error);