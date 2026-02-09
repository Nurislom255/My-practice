// src/db/storage.js
// Provides CRUD operations for vocabulary words and synonym/antonym lists.

import { WORDS_KEY, SYN_ANT_KEY, read, write } from './schema.js';

// Embedded default data.  These values are used as a fallback when fetching the
// JSON files fails (for example, when the app is opened via the file:// protocol
// and the browser blocks fetch()).
const DEFAULT_WORDS = [
  { word: 'happy', definition: 'Feeling or showing pleasure or contentment.' },
  { word: 'sad', definition: 'Feeling sorrow or unhappiness.' },
  { word: 'fast', definition: 'Moving or capable of moving at high speed.' },
  { word: 'slow', definition: 'Moving or operating at a low speed.' },
  { word: 'big', definition: 'Of considerable size, extent, or intensity.' },
  { word: 'small', definition: 'Of a size that is less than normal or usual.' },
  { word: 'good', definition: 'To be desired or approved of; having the required qualities.' },
  { word: 'bad', definition: 'Not such as to be hoped for or desired; unpleasant or unwelcome.' },
  { word: 'hot', definition: 'Having a high degree of heat or a high temperature.' },
  { word: 'cold', definition: 'Of or at a low or relatively low temperature.' },
  { word: 'light', definition: 'Of little weight; easy to lift.' },
  { word: 'dark', definition: 'With little or no light.' },
  { word: 'strong', definition: 'Having the power to move heavy weights or perform other physically demanding tasks.' },
  { word: 'weak', definition: 'Lacking the power to perform physically demanding tasks; lacking physical strength.' },
  { word: 'early', definition: 'Happening or done before the usual or expected time.' },
  { word: 'late', definition: 'Doing something or taking place after the expected, proper, or usual time.' },
  { word: 'young', definition: 'Having lived or existed for only a short time; not old.' },
  { word: 'old', definition: 'Having lived for a long time; no longer young.' },
  { word: 'easy', definition: 'Achieved without great effort; presenting few difficulties.' },
  { word: 'hard', definition: 'Requiring a great deal of endurance or effort.' },
];

const DEFAULT_SYN_ANT = {
  happy: { synonyms: ['joyful', 'content', 'cheerful'], antonyms: ['sad', 'unhappy'] },
  sad: { synonyms: ['unhappy', 'sorrowful', 'dejected'], antonyms: ['happy', 'cheerful'] },
  fast: { synonyms: ['quick', 'rapid', 'swift'], antonyms: ['slow', 'sluggish'] },
  slow: { synonyms: ['sluggish', 'lethargic', 'unhurried'], antonyms: ['fast', 'quick'] },
  big: { synonyms: ['large', 'huge', 'vast'], antonyms: ['small', 'tiny'] },
  small: { synonyms: ['little', 'tiny', 'minute'], antonyms: ['big', 'large'] },
  good: { synonyms: ['excellent', 'fine', 'positive'], antonyms: ['bad', 'poor'] },
  bad: { synonyms: ['poor', 'wrong', 'inferior'], antonyms: ['good', 'excellent'] },
  hot: { synonyms: ['warm', 'heated', 'fiery'], antonyms: ['cold', 'cool'] },
  cold: { synonyms: ['chilly', 'cool', 'frigid'], antonyms: ['hot', 'warm'] },
  light: { synonyms: ['weightless', 'airy', 'featherlight'], antonyms: ['heavy', 'weighty'] },
  dark: { synonyms: ['dim', 'gloomy', 'black'], antonyms: ['light', 'bright'] },
  strong: { synonyms: ['powerful', 'robust', 'sturdy'], antonyms: ['weak', 'frail'] },
  weak: { synonyms: ['frail', 'feeble', 'fragile'], antonyms: ['strong', 'powerful'] },
  early: { synonyms: ['premature', 'untimely', 'ahead'], antonyms: ['late', 'tardy'] },
  late: { synonyms: ['tardy', 'belated', 'overdue'], antonyms: ['early', 'punctual'] },
  young: { synonyms: ['youthful', 'junior', 'immature'], antonyms: ['old', 'aged'] },
  old: { synonyms: ['aged', 'elderly', 'ancient'], antonyms: ['young', 'new'] },
  easy: { synonyms: ['simple', 'effortless', 'straightforward'], antonyms: ['hard', 'difficult'] },
  hard: { synonyms: ['difficult', 'challenging', 'tough'], antonyms: ['easy', 'simple'] },
};

/**
 * Initialise the storage.  If no words are present, load the defaults from the JSON files.
 */
export async function initDB() {
  const existingWords = read(WORDS_KEY);
  const existingSynAnt = read(SYN_ANT_KEY);
  if (!existingWords || existingWords.length === 0) {
    await loadDefaults();
  }
  if (!existingSynAnt) {
    await loadDefaults();
  }
}

/**
 * Load default words and synonyms/antonyms from the public/data folder.  This function
 * performs network requests to fetch the JSON/JSONL files when the app first runs.
 */
async function loadDefaults() {
  // Try to fetch defaults; fall back to embedded constants on failure
  try {
    const wordsResponse = await fetch('data/default_words.jsonl');
    if (!wordsResponse.ok) throw new Error('Failed to fetch words');
    const text = await wordsResponse.text();
    const lines = text.trim().split(/\n+/);
    const words = lines.map((line) => JSON.parse(line));
    write(WORDS_KEY, words);
    const synAntResponse = await fetch('data/default_synonyms_antonyms.json');
    if (!synAntResponse.ok) throw new Error('Failed to fetch syn/ant');
    const synAnt = await synAntResponse.json();
    write(SYN_ANT_KEY, synAnt);
  } catch (err) {
    write(WORDS_KEY, DEFAULT_WORDS);
    write(SYN_ANT_KEY, DEFAULT_SYN_ANT);
  }
}

/**
 * Get all stored vocabulary words.
 * @returns {Array<{word: string, definition: string}>}
 */
export function getWords() {
  return read(WORDS_KEY) || [];
}

/**
 * Get synonyms and antonyms map.
 * @returns {Record<string, {synonyms: string[], antonyms: string[]}>}
 */
export function getSynAnt() {
  return read(SYN_ANT_KEY) || {};
}

/**
 * Save a new word.  If the word already exists, returns false.
 * @param {string} word
 * @param {string} definition
 * @param {string[]} synonyms
 * @param {string[]} antonyms
 * @returns {boolean} whether the operation succeeded
 */
export function addWord(word, definition, synonyms = [], antonyms = []) {
  word = word.trim().toLowerCase();
  if (!word) return false;
  const words = getWords();
  if (words.some((w) => w.word.toLowerCase() === word)) {
    return false;
  }
  words.push({ word, definition });
  write(WORDS_KEY, words);
  // update synonyms/antonyms
  const synAnt = getSynAnt();
  synAnt[word] = {
    synonyms: synonyms.filter((s) => s.trim() !== ''),
    antonyms: antonyms.filter((a) => a.trim() !== ''),
  };
  write(SYN_ANT_KEY, synAnt);
  return true;
}

/**
 * Retrieve a vocabulary entry by word (case insensitive).
 * @param {string} word
 * @returns {{word: string, definition: string, synonyms: string[], antonyms: string[]} | null}
 */
export function getEntry(word) {
  const words = getWords();
  const entry = words.find((w) => w.word.toLowerCase() === word.toLowerCase());
  if (!entry) return null;
  const synAnt = getSynAnt();
  const meta = synAnt[word.toLowerCase()] || { synonyms: [], antonyms: [] };
  return { ...entry, synonyms: meta.synonyms, antonyms: meta.antonyms };
}