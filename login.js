// fake user store — persists during the session
const fakeUsers = [
  { username: "testuser", password: "password123", email: "test@test.com" }
];

async function login() {
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;

  if (!username || !password) {
    alert("Please fill in all fields");
    return;
  }

  // check against fake users
  const user = fakeUsers.find(u => u.username === username && u.password === password);

  if (user) {
    sessionStorage.setItem("loggedIn", "true");
    sessionStorage.setItem("username", username);
    alert(`Welcome ${username}!`);
    window.location.href = "index.html";
    return;
  }

  alert("Invalid username or password");
}

async function register() {
  const username = document.getElementById("auth-username").value.trim();
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  if (!username || !email || !password) {
    alert("Please fill in all fields");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }

  // check if username already taken
  const exists = fakeUsers.find(u => u.username === username);
  if (exists) {
    alert("Username already taken");
    return;
  }

  // add to fake users
  fakeUsers.push({ username, email, password });
  alert(`Account created! You can now login as ${username}`);

  // switch back to login
  toggleForm();
}

let isRegister = false;

function toggleForm() {
  isRegister = !isRegister;

  const title        = document.getElementById("auth-title");
  const subtitle     = document.getElementById("auth-subtitle");
  const btn          = document.getElementById("auth-btn");
  const switcher     = document.getElementById("auth-switch");
  const emailGroup   = document.getElementById("email-group");

  title.textContent        = isRegister ? "Create Account" : "Welcome Back";
  subtitle.textContent     = isRegister ? "Register to play" : "Login to play";
  btn.textContent          = isRegister ? "Register" : "Login";
  emailGroup.style.display = isRegister ? "block" : "none";
  switcher.textContent     = isRegister
    ? "Already have an account? Login"
    : "Don't have an account? Register";
}

document.getElementById("auth-btn").addEventListener("click", () => {
  isRegister ? register() : login();
});

document.getElementById("auth-switch").addEventListener("click", toggleForm);

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") isRegister ? register() : login();
});