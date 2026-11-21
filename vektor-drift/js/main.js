// Einstiegspunkt: verdrahtet Canvas, Eingabe, Audio, UI und Spielschleife.

import { Game } from './game.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { loadLastName, saveLastName } from './storage.js';

const canvas = document.getElementById('game');
const form = document.getElementById('name-entry');
const nameInput = document.getElementById('ne-name');
const scoreLabel = document.getElementById('ne-score');
const muteBtn = document.getElementById('btn-mute');

const input = new Input();
const sound = new Sound();
input.onGesture = () => sound.unlock();

const ui = {
  setMuted(m) {
    muteBtn.classList.toggle('off', m);
  },
  showNameEntry(score) {
    input.reset();
    scoreLabel.textContent = `${score} Punkte`;
    nameInput.value = loadLastName();
    form.hidden = false;
    // Auf dem iPad öffnet die Tastatur nur nach einer Nutzergeste – Fokus trotzdem versuchen.
    setTimeout(() => nameInput.focus(), 50);
  },
  hideNameEntry() {
    form.hidden = true;
    nameInput.blur();
  },
};
ui.setMuted(sound.muted);

const game = new Game(canvas, input, sound, ui);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim().toUpperCase() || '???';
  saveLastName(name);
  game.submitName(name);
});

window.addEventListener('resize', () => game.resize());
window.addEventListener('orientationchange', () => setTimeout(() => game.resize(), 200));

// Bei App-Wechsel automatisch pausieren
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    input.reset();
    sound.stopLoops();
    if (game.state === 'playing') game.setState('paused');
  }
});

// iOS: Doppeltipp-Zoom und Pinch zuverlässig unterbinden
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---------------- Spielschleife mit festem Zeitschritt ----------------
const STEP = 1 / 120;
let last = performance.now();
let acc = 0;

function frame(now) {
  acc += Math.min((now - last) / 1000, 0.1);
  last = now;
  let steps = 0;
  while (acc >= STEP) {
    game.update(STEP);
    acc -= STEP;
    if (++steps >= 15) { acc = 0; break; }
  }
  if (steps) input.endFrame();
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Für Tests/Debugging
window.__game = game;
