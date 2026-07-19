(function () {
  let isOnline = navigator.onLine;
  
  // Network state management
  window.addEventListener('online', function () {
    isOnline = true;
    const errorMsg = document.getElementById('no-session');
    if (errorMsg) errorMsg.classList.add('hidden');
  });
  window.addEventListener('offline', function () {
    isOnline = false;
    const errorMsg = document.getElementById('no-session');
    if (errorMsg) {
      errorMsg.innerHTML = 'No internet connection. Please check your network.';
      errorMsg.classList.remove('hidden');
    }
  });

  AuthService.waitForAuth()
    .then(function () {
      const user = AuthService.getCurrentUser();

      if (!user) {
        const noSessionEl = document.getElementById('no-session');
        if (noSessionEl) {
          noSessionEl.innerHTML = 'No active session. Please <a href="login.html">sign in</a>.';
          noSessionEl.classList.remove('hidden');
        }
        return;
      }

      window.location.replace('cosmobot-dashboard.html');
    })
    .catch(function (err) {
      console.error('Auth error:', err.message);
      const noSessionEl = document.getElementById('no-session');
      if (noSessionEl) {
        noSessionEl.innerHTML = 'Error loading session. Please <a href="login.html">try again</a>.';
        noSessionEl.classList.remove('hidden');
      }
    });
})();
