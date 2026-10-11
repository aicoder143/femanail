'use strict';
let deferredInstallPrompt = null;
const installButton = document.getElementById('installAppBtn');
const installDialog = document.getElementById('installDialog');
const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

if (installed && installButton) installButton.hidden = true;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  if (installButton) installButton.hidden = true;
  if (installDialog?.open) installDialog.close();
});

installButton?.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  } else if (installDialog?.showModal) {
    installDialog.showModal();
  }
});

installDialog?.addEventListener('click', event => {
  if (event.target === installDialog) installDialog.close();
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
