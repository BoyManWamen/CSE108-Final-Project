function showError(msg) {
  document.getElementById('auth-error').textContent   = msg;
  document.getElementById('auth-success').textContent = '';
}
function showSuccess(msg) {
  document.getElementById('auth-success').textContent = msg;
  document.getElementById('auth-error').textContent   = '';
}
function setLoading(on) {
  const btn = document.getElementById('auth-btn');
  btn.disabled    = on;
  btn.textContent = on
    ? (isRegister ? 'Registering…' : 'Logging in…')
    : (isRegister ? 'Register'     : 'Login');
}

async function login() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!username || !password) { showError('Please fill in all fields.'); return; }
  setLoading(true);
  try {
    const res  = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || 'Login failed.'); return; }
    sessionStorage.setItem('loggedIn',  'true');
    sessionStorage.setItem('username',  data.username);
    sessionStorage.setItem('totalWins', data.totalWins);
    showSuccess(`Welcome back, ${data.username}! Loading…`);
    setTimeout(() => window.location.href = 'index.html', 800);
  } catch (err) {
    showError('Could not reach the server. Please try again.');
    console.error(err);
  } finally {
    setLoading(false);
  }
}

async function register() {
  const username = document.getElementById('auth-username').value.trim();
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!username || !email || !password) { showError('Please fill in all fields.'); return; }
  setLoading(true);
  try {
    const res  = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || 'Registration failed.'); return; }
    showSuccess('Account created! You can now log in.');
    setTimeout(toggleForm, 1200);
  } catch (err) {
    showError('Could not reach the server. Please try again.');
    console.error(err);
  } finally {
    setLoading(false);
  }
}

let isRegister = false;
function toggleForm() {
  isRegister = !isRegister;
  document.getElementById('auth-title').textContent    = isRegister ? 'Create Account' : 'Welcome Back';
  document.getElementById('auth-subtitle').textContent = isRegister ? 'Register to play' : 'Login to play';
  document.getElementById('auth-btn').textContent      = isRegister ? 'Register' : 'Login';
  document.getElementById('email-group').style.display = isRegister ? 'block' : 'none';
  document.getElementById('auth-switch').textContent   = isRegister
    ? 'Already have an account? Login'
    : "Don't have an account? Register";
  showError(''); showSuccess('');
}

document.getElementById('auth-btn').addEventListener('click', () => isRegister ? register() : login());
document.getElementById('auth-switch').addEventListener('click', toggleForm);
document.addEventListener('keydown', (e) => { if (e.key === 'Enter') isRegister ? register() : login(); });