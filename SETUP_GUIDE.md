# Geopolitical Decision Game - Setup Guide

Welcome! This guide will walk you through setting up and running the Geopolitical Decision Game on your laptop.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the Game](#running-the-game)
4. [Customization](#customization)
5. [Building for Production](#building-for-production)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you start, you'll need to install Node.js and npm (Node Package Manager). These are required to build and run the game.

### Windows Installation

1. **Download Node.js**
   - Visit [https://nodejs.org/](https://nodejs.org/)
   - Download the **LTS (Long Term Support)** version
   - Run the installer and follow the prompts (accept all defaults)
   - Node.js includes npm automatically

2. **Verify Installation**
   - Open PowerShell or Command Prompt
   - Run the following commands:
     ```
     node --version
     npm --version
     ```
   - You should see version numbers for both (e.g., `v20.x.x` and `10.x.x`)

### macOS Installation

1. **Using Homebrew (Recommended)**
   - Open Terminal
   - Install Homebrew if you don't have it:
     ```
     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
     ```
   - Install Node.js:
     ```
     brew install node
     ```

2. **Or download directly:**
   - Visit [https://nodejs.org/](https://nodejs.org/)
   - Download the macOS LTS installer
   - Run the installer

3. **Verify Installation**
   - Open Terminal
   - Run:
     ```
     node --version
     npm --version
     ```

### Linux Installation

Use your package manager:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install nodejs npm

# Fedora
sudo dnf install nodejs npm

# Arch
sudo pacman -S nodejs npm
```

Verify with:
```bash
node --version
npm --version
```

---

## Installation

### Step 1: Get the Code

Clone or download the game repository to your laptop. If you have the code as a zip file, extract it to a folder of your choice (e.g., `C:\Users\YourName\my-app` on Windows).

### Step 2: Open a Terminal in the Game Directory

**Windows (PowerShell):**
- Open File Explorer
- Navigate to the game folder
- Right-click in the folder → "Open PowerShell window here"

**macOS/Linux (Terminal):**
- Open Terminal
- Navigate to the folder:
  ```bash
  cd /path/to/game/folder
  ```

### Step 3: Install Dependencies

In your terminal, run:

```bash
npm install
```

This command will download and install all the required libraries (React, Vite, ESLint, etc.). It may take 2-5 minutes depending on your internet speed. You'll see a new folder called `node_modules` appear in your game directory.

**Important:** Do NOT upload the `node_modules` folder to GitHub or share it with others. It's automatically created from `package.json` and is very large (~500MB+).

---

## Running the Game

### Development Mode (Recommended for Testing)

Once dependencies are installed, run:

```bash
npm run dev
```

You'll see output like:
```
  VITE v8.x.x  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  Press q to quit
```

1. Open your web browser
2. Go to `http://localhost:5173/`
3. The game should load and you're ready to play!

**Hot Module Replacement (HMR):** If you make changes to the code files while the dev server is running, the browser will automatically refresh. This is great for testing customizations.

To stop the server, press `q` in the terminal.

### Production Build (For Sharing/Deployment)

To create an optimized version of the game:

```bash
npm run build
```

This creates a `dist` folder with the compiled game. The build process:
- Minifies the code (makes it smaller)
- Optimizes assets
- Prepares it for distribution

To preview the production build locally:

```bash
npm run preview
```

Then visit `http://localhost:5173/` to see the optimized version.

---

## Customization

The game is highly customizable. All configuration is in one file:

**File:** `src/nothing-to-see-here-yep.jsx`

### Configuration Section (Top of File)

#### Game Length
```javascript
const TOTAL_ROUNDS = 10; // Change to 5, 15, 20, etc.
```

#### Difficulty Levels (Ascension)
```javascript
const ASCENSION_MULTIPLIERS = [
  0.5,  // 0 - chill mode (50% drink multiplier)
  0.6,  // 1
  // ... up to ...
  2.5,  // 10 - apocalypse mode (250% drink multiplier)
];
const DEFAULT_ASCENSION = 4; // Starting difficulty
```

The multiplier affects how many drinks are assigned for each action. Edit the array to change how much harder/easier each level is.

#### Ascension Level Messages
```javascript
const ascensionBriefing = (level) => {
  if (level <= 1) return "Your delegation has requested a diplomatic pace...";
  // ... etc
};
```

These are the flavor text messages shown at the start for each difficulty level. Edit them to add your own inside jokes.

#### Custom Inside Joke (Final Slide)
```javascript
const INTRO_INSIDE_JOKE = ""; // Leave empty or add custom text
```

### Audio Setup

**To add background music:**

1. Find MP3, WAV, OGG, or M4A audio files
2. Place them in: `src/assets/audio/`
3. Restart the dev server (`npm run dev`)
4. Music will shuffle and play on loop after the first click
5. To control volume:
   ```javascript
   const AUDIO_VOLUME = 0.55; // Range: 0.0 to 1.0
   ```

**To add a "Pose Sound" (e.g., air horn for when players click Pose):**

1. Place an audio file in `src/assets/audio/`
2. Make sure the filename contains the word specified in `POSE_SOUND_MATCH`
   ```javascript
   const POSE_SOUND_MATCH = 'horn'; // Match any file with "horn" in the name
   ```
3. This file will be excluded from background music and played on-demand
4. Control its volume:
   ```javascript
   const POSE_SOUND_VOLUME = 1.0; // Usually loud!
   ```

### Video Setup (Podium Hijack)

**To add an end-game video (plays after the game ends):**

1. Have a video file in MP4, WebM, MOV, or M4V format
   - If you only have AVI: convert with `ffmpeg -i your.avi -c:v libx264 -c:a aac out.mp4`
2. Place it in: `src/assets/videos/`
3. Restart the dev server
4. The first video found will auto-play at game end with TV static effect
5. Control playback:
   ```javascript
   const HIJACK_VIDEO_VOLUME = 1.0; // 0.0 to 1.0
   const HIJACK_DELAY_MS = 3000; // Delay before hijack starts (milliseconds)
   ```

### Custom Scenarios

Add your own geopolitical scenarios or inside jokes. In the "CUSTOMIZATION ZONE" section:

```javascript
const CUSTOM_SCENARIOS = [
  {
    text: "Your headline here. Keep it short (1-2 sentences).",
    tags: ["scandal", "absurd"] // Choose from existing tags
  },
  // Add more scenarios...
];
```

Available tags: `military`, `escalation`, `scandal`, `deflect`, `diplomatic`, `media`, `mystery`, `absurd`, `cyber`, `economic`, `corruption`, `aid`, `Ukraine`, `alliance`, `tension`, `diplomacy`, `domestic politics`, `sports`, `legal`, `congress`, `investigation`, `education`, `policy`, `transparency`, `geopolitics`, `election`, `infighting`, `energy`, `trade war`, `casualties`, `stalemate`, `intelligence`, `policy shift`, `controversy`, `war`, `optics`, `election`, `resignation`.

### Custom Actions

Add custom response actions players can choose:

```javascript
const CUSTOM_ACTIONS = [
  {
    id: 'custom-action-1',
    label: 'Action Name',
    emoji: '🎯',
    chaos: 3,           // 0-10: how reckless is this?
    deflection: 2,      // 0-5: how well does it distract?
    desc: ["One-liner 1", "One-liner 2", "One-liner 3"] // Random selection
  },
];
```

### Custom Ticker Headlines

Add scrolling "Breaking News" ticker items:

```javascript
const CUSTOM_TICKER = [
  "Your news headline here (short!)",
  "Another breaking story",
];
```

### Customize Famous Name Replacements

Replace real names with player names during gameplay. Edit the patterns:

```javascript
const FAMOUS_NAME_PATTERNS = [
  /\bTrump(?:'s)?\b/g,  // Example
  /\bYourName(?:'s)?\b/g,  // Add your own
];
```

---

## Building for Production

When you're happy with your customizations, create a production-ready version:

```bash
npm run build
```

This creates a `dist` folder containing everything needed to run the game.

### To Share via GitHub

**Include in your repository:**
- `src/` (all source code)
- `public/` (public assets)
- `package.json`
- `vite.config.js`
- `eslint.config.js`
- `index.html`
- `README.md` or `SETUP_GUIDE.md`

**DO NOT include:**
- `node_modules/` (recreated by `npm install`)
- `dist/` (recreated by `npm run build`)
- `.git/` (if starting fresh)

### To Share the Built Game (Standalone)

If you want someone to just play without installing dependencies:

1. Run `npm run build`
2. Send them the `dist/` folder
3. They can open `dist/index.html` directly in a browser
4. Note: This works for local play but not for changes/customization

---

## Troubleshooting

### "Command not found: npm"
- Node.js and npm aren't installed or not in your PATH
- Restart your terminal after installing Node.js
- Try running `npm --version` again

### "ENOENT: no such file or directory"
- Make sure you're running commands in the correct folder
- Verify you're in the game directory with `package.json`

### Dev server won't start
- Check that port 5173 isn't already in use
- Try killing other processes using the port, or restart your terminal

### Audio/Video files aren't showing up
- Make sure files are in the correct folders:
  - Audio: `src/assets/audio/`
  - Video: `src/assets/videos/`
- Restart the dev server after adding files
- Check that file extensions are supported (MP3, WAV, OGG, M4A for audio; MP4, WebM, MOV, M4V for video)

### Game looks broken or has errors
- Open the browser's Developer Console (F12 → Console tab)
- Look for error messages
- Try clearing your browser cache and reloading

### Customizations aren't showing up
- Make sure changes are in `src/nothing-to-see-here-yep.jsx`
- Restart the dev server (`npm run dev`)
- Hard refresh your browser (Ctrl+Shift+R on Windows, Cmd+Shift+R on macOS)

### Build fails with errors
- Run `npm install` again to ensure all dependencies are installed
- Check for syntax errors in your customizations (missing commas, brackets, etc.)
- Run the linter to check for issues: `npm run lint`

---

## Project Structure

```
my-app/
├── src/
│   ├── nothing-to-see-here-yep.jsx     ← MAIN GAME FILE (edit this!)
│   ├── App.jsx                          ← React component wrapper
│   ├── App.css                          ← Styling
│   ├── main.jsx                         ← Entry point
│   ├── index.css                        ← Global styles
│   └── assets/
│       ├── audio/                       ← Add your MP3/WAV files here
│       ├── images/                      ← Game images
│       └── videos/                      ← Add your MP4/WebM files here
├── public/                              ← Static files
├── dist/                                ← Generated production build
├── node_modules/                        ← Dependencies (DO NOT EDIT)
├── package.json                         ← Project configuration
├── vite.config.js                       ← Vite build configuration
├── eslint.config.js                     ← Code linting rules
├── index.html                           ← Entry HTML file
└── SETUP_GUIDE.md                       ← This file!
```

---

## Tips & Best Practices

1. **Test customizations locally first** - Always run `npm run dev` and test changes before building
2. **Back up your work** - Save backups of custom scenarios/actions before major changes
3. **Keep it short** - Scenario text, action names, and headlines work best when concise
4. **Use emojis** - They make the UI more fun and readable
5. **Balance chaos and deflection** - Custom actions should vary in intensity
6. **Test with full rounds** - Play through multiple rounds to catch issues
7. **Accessibility** - Consider colorblind-friendly design if customizing the UI

---

## Need Help?

If something doesn't work:
1. Check that Node.js/npm are installed: `npm --version`
2. Verify you're in the correct directory: `ls package.json` (should show the file)
3. Try deleting `node_modules` and running `npm install` again
4. Check the browser console (F12) for JavaScript errors
5. Look at the terminal output for error messages

---

## Have fun! 🎉

The game is ready to customize and play. Enjoy hosting rounds and watching everyone's decision-making (and drinks) escalate!
