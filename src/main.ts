import { Game } from './Game';

const errEl = document.getElementById('error-overlay')!;
function showError(message: string): void {
  errEl.style.display = 'block';
  errEl.textContent += message + '\n';
}
window.addEventListener('error', (e) => showError(String(e.error?.stack ?? e.message)));
window.addEventListener('unhandledrejection', (e) => showError('Unhandled rejection: ' + String(e.reason)));

const game = new Game(document.getElementById('app')!);

// QA hook for automated browser testing: teleport / getState / debugStart.
(window as unknown as Record<string, unknown>).COLDSTORAGE = game;

console.info('[COLDSTORAGE] Phase 0 gray-box initialized');
