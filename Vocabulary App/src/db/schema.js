// src/db/schema.js
// Defines keys used to store data in localStorage and exports simple helper functions.

export const WORDS_KEY = 'vocab_words';
export const SYN_ANT_KEY = 'syn_ant';

/**
 * Parse a JSON string safely.  Returns null on error.
 * @param {string} text
 */
export function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

/**
 * Write a value to localStorage.
 * @param {string} key
 * @param {any} value
 */
export function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Read a value from localStorage.
 * @param {string} key
 * @returns {any | null}
 */
export function read(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return safeParse(raw);
}