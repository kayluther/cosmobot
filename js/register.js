(function () {
  const form = document.getElementById('register-form');
  const successView = document.getElementById('success-view');
  const serverError = document.getElementById('server-error');
  const submitBtn = document.getElementById('submit-btn');
  const touched = {};

  const fields = ['name', 'email', 'password', 'confirmPassword', 'age'];

  AuthService.waitForAuth().then(function () {
    if (AuthService.getCurrentUser()) {
      window.location.replace('cosmobot-dashboard.html');
    }
  });

  function getFormData() {
    return {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      confirmPassword: document.getElementById('confirmPassword').value,
      age: document.getElementById('age').value,
    };
  }

  function validateField(name, value, data) {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'User name is required.';
        if (value.trim().length < 2) return 'Name must be at least 2 characters.';
        return '';
      case 'email':
        if (!value.trim()) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
        return '';
      case 'password':
        if (!value) return 'Password is required.';
        if (value.length < 8) return 'Password must be at least 8 characters.';
        return '';
      case 'confirmPassword':
        if (!value) return 'Please confirm your password.';
        if (value !== data.password) return 'Passwords do not match.';
        return '';
      case 'age': {
        if (!value && value !== 0 && value !== '0') return 'Age is required.';
        const num = Number(value);
        if (isNaN(num) || !Number.isInteger(num)) return 'Age must be a whole number.';
        if (num < 0 || num > 100) return 'Age must be between 0 and 100.';
        return '';
      }
      default:
        return '';
    }
  }

  function showError(name, msg) {
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

  function validateAndShow(name, data) {
    if (!touched[name]) return;
    const value = data ? data[name] : document.getElementById(name).value;
    const d = data || getFormData();
    showError(name, validateField(name, value, d));
  }

  fields.forEach(function (name) {
    const el = document.getElementById(name);
    el.addEventListener('blur', function () {
      touched[name] = true;
      validateAndShow(name);
    });
    el.addEventListener('input', function () {
      serverError.classList.add('hidden');
      if (touched[name]) validateAndShow(name);
      if (name === 'password' && touched.confirmPassword) validateAndShow('confirmPassword');
    });
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    serverError.classList.add('hidden');
    fields.forEach(function (f) { touched[f] = true; });

    const data = getFormData();
    let hasError = false;
    fields.forEach(function (name) {
      const err = validateField(name, data[name], data);
      showError(name, err);
      if (err) hasError = true;
    });
    if (hasError) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    const result = await AuthService.registerStudent(data);

    if (result.error) {
      serverError.textContent = result.error;
      serverError.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="btn-panel-dot"></span> Complete Registration';
      return;
    }

    form.classList.add('hidden');
    successView.classList.remove('hidden');

    setTimeout(function () {
      window.location.href = 'login.html?registered=1&email=' + encodeURIComponent(result.user.email);
    }, 2000);
  });
})();
