export function initWindowControls() {
  const { appWindow } = window.__TAURI__ ? window.__TAURI__.window : { appWindow: null };

  const titlebar = document.getElementById('titlebar-controls');
  if (titlebar && appWindow) {
    titlebar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.getAttribute('data-action');
        if (action === 'minimize') {
          appWindow.minimize();
        } else if (action === 'maximize') {
          appWindow.toggleMaximize();
        } else if (action === 'close') {
          appWindow.close();
        }
      }
    });
  } else if (!window.__TAURI__ && titlebar) {
    console.warn("Tauri API not found. Window controls will not function in browser environment.");
    // Optional fallback for browser preview
    titlebar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn && btn.getAttribute('data-action') === 'close') {
        alert("Close action triggered (Browser mock)");
      }
    });
  }
}
