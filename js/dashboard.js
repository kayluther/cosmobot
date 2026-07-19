(function () {
  AuthService.waitForAuth().then(function () {
    const user = AuthService.getCurrentUser();

    if (!user) {
      document.getElementById('no-session').classList.remove('hidden');
      return;
    }

    window.location.replace('cosmobot-dashboard.html');
  });
})();
