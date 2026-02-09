# Vocabulary App

This repository contains a minimal but fully‑functional vocabulary study application.  It is designed to work entirely in the browser without any external dependencies.  The application ships with a small dataset (under 100 words) along with definitions, synonyms and antonyms, and allows users to add their own words, study them in a flashcard format, and play matching games.

## Project Structure

The app follows a simple structure:

```
├── public
│   ├── assets                # Static image/icon placeholders
│   ├── data                  # Default vocabulary dataset
│   ├── index.html            # Entry point for the web app
│   └── info.txt              # Short description of the app
├── src
│   ├── db
│   │   ├── migrate.js        # Populates local storage from default data
│   │   ├── schema.js         # Shared constants and helpers
│   │   └── storage.js        # Wrapper around browser localStorage
│   ├── pages
│   │   ├── add-words-definitions  # UI for adding new words
│   │   ├── home                   # Word list and lookup
│   │   ├── play-games             # Simple synonym/antonym matching game
│   │   └── practice               # Flashcard‑style practice page
│   ├── shared
│   │   ├── styles
│   │   │   ├── ui                 # Component‑level CSS modules
│   │   │   └── utils              # Utility functions (empty placeholder)
│   └── main.js                # App entry module handling routing
└── styles
    ├── base.css              # Normalisation and basic layout
    ├── components.css        # Reusable UI components
    └── root.css              # Global CSS custom properties
```

The application does not rely on any build tools or frameworks; all JavaScript modules are loaded natively in the browser via `<script type="module">` tags.  Data persistence uses the browser’s `localStorage` API, so any words you add will remain available on subsequent visits to the app (within the same browser on the same device).

## Running the App

To run the app locally, serve the `public` directory with any simple HTTP server so that the browser can fetch the static assets.  For example, using Python 3:

```bash
cd public
python3 -m http.server 8000
```

Then open your browser to `http://localhost:8000` to start using the vocabulary app.

## Features

* **Home** – lists all stored words with their definitions and allows quick search.
* **Add Words** – lets you add a new vocabulary entry including its definition, synonyms and antonyms.  The app prevents duplicate entries.
* **Practice** – presents flashcards where you guess definitions for random words.  Flip the card to reveal the answer and move to the next one.
* **Play Games** – offers a simple multiple‑choice matching game for synonyms or antonyms.  You can toggle between synonyms and antonyms to practise both.

The initial dataset is intentionally small to keep the project lightweight.  Feel free to extend the JSON files in `public/data` with more words and update the schema accordingly.
