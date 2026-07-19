(function () {
  const params = new URLSearchParams(window.location.search);
  const loginForm = document.getElementById('login-form');
  const resetView = document.getElementById('reset-view');
  const resetForm = document.getElementById('reset-form');
  const serverError = document.getElementById('server-error');
  const registeredBanner = document.getElementById('registered-banner');
  const emailInput = document.getElementById('email');
  const resetEmailInput = document.getElementById('reset-email');
  const loginBtn = document.getElementById('login-btn');
  const resetBtn = document.getElementById('reset-btn');
  const touched = {};

  AuthService.waitForAuth().then(function () {
    if (AuthService.getCurrentUser()) {
      window.location.replace('cosmobot-dashboard.html');
    }
  });

  if (params.get('registered') === '1') {
    registeredBanner.classList.remove('hidden');
    const email = params.get('email');
    if (email) emailInput.value = decodeURIComponent(email);
  }

  function showFieldError(name, msg) {
    const wrap = document.querySelector('[data-field="' + name + '"]');
    const box = wrap.querySelector('.field-box');
    const errEl = wrap.querySelector('[data-error="' + name + '"]');
    if (msg) {
      box.classList.add('is-error');
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    } else {
      box.classList.remove('is-error');
      errEl.classList.add('hidden');
    }
  }

  function validateLogin() {
    const errors = {};
    const email = emailInput.value;
    const password = document.getElementById('password').value;
    if (!email.trim()) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Password is required.';
    return errors;
  }

  ['email', 'password'].forEach(function (name) {
    document.getElementById(name).addEventListener('blur', function () {
      touched[name] = true;
      const errors = validateLogin();
      if (touched[name]) showFieldError(name, errors[name] || '');
    });
    document.getElementById(name).addEventListener('input', function () {
      serverError.classList.add('hidden');
      if (touched[name]) showFieldError(name, '');
    });
  });

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    serverError.classList.add('hidden');
    touched.email = true;
    touched.password = true;

    const errors = validateLogin();
    showFieldError('email', errors.email || '');
    showFieldError('password', errors.password || '');
    if (Object.keys(errors).length) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Authenticating...';

    const result = await AuthService.loginStudent({
      email: emailInput.value,
      password: document.getElementById('password').value,
    });

    if (result.error) {
      serverError.textContent = 'Error: ' + result.error;
      serverError.classList.remove('hidden');
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<span class="btn-panel-dot"></span> Sign In';
      return;
    }

    window.location.href = 'cosmobot-dashboard.html';
  });

  document.getElementById('show-reset-btn').addEventListener('click', function () {
    loginForm.classList.add('hidden');
    resetView.classList.remove('hidden');
    resetEmailInput.value = emailInput.value;
  });

  document.getElementById('back-login-btn').addEventListener('click', function () {
    resetView.classList.add('hidden');
    loginForm.classList.remove('hidden');
    document.getElementById('reset-error').classList.add('hidden');
    document.getElementById('reset-message').classList.add('hidden');
  });

  resetForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const errEl = document.getElementById('reset-error');
    const msgEl = document.getElementById('reset-message');
    errEl.classList.add('hidden');
    msgEl.classList.add('hidden');

    resetBtn.disabled = true;
    resetBtn.textContent = 'Sending...';

    const result = await AuthService.resetPassword(resetEmailInput.value);

    resetBtn.disabled = false;
    resetBtn.innerHTML = '<span class="btn-panel-dot"></span> Send Reset Link';

    if (result.error) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
    } else {
      msgEl.textContent = result.message;
      msgEl.classList.remove('hidden');
    }
  });
})();
