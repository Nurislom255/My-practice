// src/main.js
// Entry point for the Vocabulary App.  Handles routing and rendering of all pages.

import { initDB, getWords, addWord, getSynAnt, getEntry } from './db/storage.js';

// Simple helper to create DOM elements
function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.substring(2), value);
    } else if (key === 'className') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  }
  children.forEach((child) => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child) {
      element.appendChild(child);
    }
  });
  return element;
}

// Initialise DB on page load
async function boot() {
  await initDB();
  route();
}

window.addEventListener('DOMContentLoaded', boot);
window.addEventListener('hashchange', route);

function setActiveLink(hash) {
  document.querySelectorAll('nav a').forEach((a) => {
    if (a.getAttribute('href') === '#' + hash) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
}

// Routing function
function route() {
  const hash = window.location.hash.replace('#', '') || 'home';
  setActiveLink(hash);
  switch (hash) {
    case 'home':
      renderHome();
      break;
    case 'add':
      renderAdd();
      break;
    case 'play':
      renderPlay();
      break;
    case 'practice':
      renderPractice();
      break;
    default:
      renderHome();
  }
}

// Home page: show list of words with definitions
function renderHome() {
  const container = document.getElementById('app');
  container.innerHTML = '';
  const words = getWords();
  const synAnt = getSynAnt();
  // Search bar
  const searchInput = el('input', {
    type: 'text',
    placeholder: 'Search words...'
  });
  const listContainer = el('div');

  function renderList(filter = '') {
    listContainer.innerHTML = '';
    const filtered = words.filter((w) =>
      w.word.toLowerCase().includes(filter.toLowerCase())
    );
    filtered.forEach((entry) => {
      const meta = synAnt[entry.word.toLowerCase()] || { synonyms: [], antonyms: [] };
      const card = el('div', { className: 'card' },
        el('h3', {}, entry.word),
        el('p', {}, entry.definition),
        meta.synonyms && meta.synonyms.length > 0
          ? el('p', {}, 'Synonyms: ' + meta.synonyms.join(', '))
          : null,
        meta.antonyms && meta.antonyms.length > 0
          ? el('p', {}, 'Antonyms: ' + meta.antonyms.join(', '))
          : null
      );
      listContainer.appendChild(card);
    });
  }
  searchInput.addEventListener('input', (e) => {
    renderList(e.target.value);
  });
  container.appendChild(el('div', { className: 'form-group' }, searchInput));
  container.appendChild(listContainer);
  renderList();
}

// Add page: form to add a new word
function renderAdd() {
  const container = document.getElementById('app');
  container.innerHTML = '';
  const form = el('form');
  const wordInput = el('input', { type: 'text', id: 'word', required: true });
  const defInput = el('textarea', { id: 'definition', required: true });
  const synInput = el('input', { type: 'text', id: 'synonyms', placeholder: 'Comma‑separated' });
  const antInput = el('input', { type: 'text', id: 'antonyms', placeholder: 'Comma‑separated' });
  const message = el('p');
  form.appendChild(el('div', { className: 'form-group' }, el('label', { for: 'word' }, 'Word'), wordInput));
  form.appendChild(el('div', { className: 'form-group' }, el('label', { for: 'definition' }, 'Definition'), defInput));
  form.appendChild(el('div', { className: 'form-group' }, el('label', { for: 'synonyms' }, 'Synonyms'), synInput));
  form.appendChild(el('div', { className: 'form-group' }, el('label', { for: 'antonyms' }, 'Antonyms'), antInput));
  const submitBtn = el('button', { type: 'submit', className: 'button primary' }, 'Add Word');
  form.appendChild(submitBtn);
  form.appendChild(message);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = wordInput.value.trim();
    const definition = defInput.value.trim();
    const synonyms = synInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    const antonyms = antInput.value.split(',').map((a) => a.trim()).filter(Boolean);
    if (!word || !definition) {
      message.textContent = 'Word and definition are required.';
      return;
    }
    const success = addWord(word, definition, synonyms, antonyms);
    if (!success) {
      message.textContent = 'The word already exists.';
    } else {
      message.textContent = 'Added successfully!';
      form.reset();
    }
  });
  container.appendChild(form);
}

// Play page: multiple choice game for synonyms/antonyms
function renderPlay() {
  const container = document.getElementById('app');
  container.innerHTML = '';
  const words = getWords();
  const synAnt = getSynAnt();
  if (words.length === 0) {
    container.appendChild(el('p', {}, 'No words available. Add some first.'));
    return;
  }
  let mode = 'syn';
  let current;

  const modeToggle = el('div', { className: 'form-group' },
    el('label', {}, 'Mode:'),
    el('select', { id: 'mode-select', onchange: (e) => {
      mode = e.target.value;
      nextQuestion();
    } },
      el('option', { value: 'syn' }, 'Synonyms'),
      el('option', { value: 'ant' }, 'Antonyms')
    )
  );
  const questionEl = el('div', { className: 'game-question' });
  const choicesEl = el('div', { className: 'choices' });
  const feedback = el('p');
  container.appendChild(modeToggle);
  container.appendChild(questionEl);
  container.appendChild(choicesEl);
  container.appendChild(feedback);

  function nextQuestion() {
    // pick a random word that has synonyms/antonyms in this mode
    const candidates = words.filter((w) => {
      const meta = synAnt[w.word.toLowerCase()] || {};
      return mode === 'syn'
        ? meta.synonyms && meta.synonyms.length > 0
        : meta.antonyms && meta.antonyms.length > 0;
    });
    if (candidates.length === 0) {
      questionEl.textContent = 'No entries with ' + (mode === 'syn' ? 'synonyms' : 'antonyms') + '. Add some!';
      choicesEl.innerHTML = '';
      return;
    }
    current = candidates[Math.floor(Math.random() * candidates.length)];
    const meta = synAnt[current.word.toLowerCase()];
    const answers = mode === 'syn' ? meta.synonyms : meta.antonyms;
    const correct = answers[Math.floor(Math.random() * answers.length)];
    questionEl.textContent = `Select the ${mode === 'syn' ? 'synonym' : 'antonym'} for "${current.word}"`;
    // prepare choices: correct + three random others
    const pool = [];
    Object.values(synAnt).forEach((m) => {
      const arr = mode === 'syn' ? m.synonyms : m.antonyms;
      pool.push(...arr);
    });
    // remove duplicates and correct answer
    const uniquePool = [...new Set(pool.filter((a) => a.toLowerCase() !== correct.toLowerCase()))];
    shuffle(uniquePool);
    const options = [correct, ...uniquePool.slice(0, 3)];
    shuffle(options);
    // render choices
    choicesEl.innerHTML = '';
    options.forEach((opt) => {
      const btn = el('div', { className: 'choice' }, opt);
      btn.addEventListener('click', () => {
        if (opt.toLowerCase() === correct.toLowerCase()) {
          feedback.textContent = 'Correct!';
        } else {
          feedback.textContent = `Wrong. Correct answer: ${correct}`;
        }
        setTimeout(() => {
          feedback.textContent = '';
          nextQuestion();
        }, 1000);
      });
      choicesEl.appendChild(btn);
    });
  }
  nextQuestion();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Practice page: flashcards
function renderPractice() {
  const container = document.getElementById('app');
  container.innerHTML = '';
  const words = getWords();
  if (words.length === 0) {
    container.appendChild(el('p', {}, 'No words available. Add some first.'));
    return;
  }
  let currentIndex = 0;
  shuffle(words);
  const card = el('div', { className: 'flashcard' });
  const nextBtn = el('button', { className: 'button primary' }, 'Next');
  let flipped = false;
  function showCard() {
    const entry = words[currentIndex];
    const meta = getSynAnt()[entry.word.toLowerCase()] || { synonyms: [], antonyms: [] };
    card.innerHTML = '';
    if (!flipped) {
      card.appendChild(el('h2', {}, entry.word));
      card.appendChild(el('p', {}, 'Click to reveal definition'));
    } else {
      card.appendChild(el('h2', {}, entry.word));
      card.appendChild(el('p', {}, entry.definition));
      if (meta.synonyms.length > 0) {
        card.appendChild(el('p', {}, 'Synonyms: ' + meta.synonyms.join(', ')));
      }
      if (meta.antonyms.length > 0) {
        card.appendChild(el('p', {}, 'Antonyms: ' + meta.antonyms.join(', ')));
      }
    }
  }
  card.addEventListener('click', () => {
    flipped = !flipped;
    showCard();
  });
  nextBtn.addEventListener('click', () => {
    flipped = false;
    currentIndex = (currentIndex + 1) % words.length;
    showCard();
  });
  container.appendChild(card);
  container.appendChild(nextBtn);
  showCard();
}