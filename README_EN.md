# One Day Peddler 🌃 (浮生一日摊)

> Software Practice 2027 course project — a text-based night-market trading game

**语言 / Language：[简体中文](README.md) | English**

**🎮 Play online: <https://mengqi132.github.io/fusheng-yiritan/>**

---

## 📖 Background

You owe your landlord **¥50,000**, due in **15 days**. With only **¥5,000** in your pocket, you set up a small night-market stall. Grilled noodles, socks, Bluetooth headsets, limited-edition sneakers, GPUs — prices change every single day. Buy low, sell high, and see if you can turn your life around in 15 days.

## 🎯 Goal

Grow your total assets to **¥50,000+** within 15 days to pay off the debt. The more you earn, the better the ending:

| Total Assets | Ending |
| --- | --- |
| ≥ 150,000 | 🏆 Business Legend |
| ≥ 80,000 | ☀️ Small Fortune |
| ≥ 50,000 | 🌧️ Debt Paid, Barely |
| < 50,000 | 💀 Bankrupt |

## 🕹️ How to Play

- **📈 Market**: 8 goods in 3 price tiers with different volatility. Click "Buy 1 / Buy 10" to stock up — watch your cash and bag capacity
- **🎒 Bag**: Shows average cost and unrealized profit/loss for each holding. Click "Sell 1 / Sell All" to cash out (red = up, green = down)
- **🌙 Close Stall**: End the day; prices fluctuate overnight
- **🏦 Bank**: Deposits are safe from thieves and fines (but earn no interest)
- **💸 Loan**: Borrow from "Lao Wang" at 5% daily compound interest — leverage for pros, a trap for rookies
- **🎒 Expand**: Pay to enlarge your bag (20 → 40 → 70 → 100 slots)
- **🎲 Random Events**: Inspectors' fines, pickpockets, influencer shout-outs, midnight wholesale deals, an insider tip seller... 35% chance per day, and some events ask you to make a choice
- **🏅 Achievements**: 9 hidden achievements to unlock
- **💾 Auto-save**: Progress is stored in your browser — close anytime, resume anytime

## 🛠️ Tech Stack

Pure front-end. No frameworks, no dependencies, no build step:

- **HTML5 + CSS3** (CSS variables, Grid/Flex, glassmorphism, gradient animations)
- **Vanilla JavaScript (ES6 Modules)**: game logic, market algorithm, event system
- **Web Audio API**: real-time synthesized sound effects, zero audio files
- **localStorage**: auto-save + all-time best record

## 📁 Project Structure

```
├── index.html        # Page structure (landing screen + game UI)
├── css/style.css     # Dark terminal-style theme (red up / green down)
├── js/
│   ├── main.js         # Game state and main loop
│   ├── market.js       # Goods definitions and price algorithm
│   ├── events.js       # Random event library
│   ├── achievements.js # Achievement system
│   ├── audio.js        # Web Audio synthesized SFX
│   └── ui.js           # Rendering and animations
├── server.js         # Optional local preview server
└── package.json
```

## 🚀 Run Locally

It is a fully static site — just open `index.html` in a browser. A local server is recommended (ES Modules require HTTP):

```bash
npm run dev        # http://localhost:7100
npm run dev -- --port 8080   # custom port
```

## 🌐 Deployment (GitHub Pages)

1. Push this repository to GitHub
2. Repo page → **Settings** → **Pages**
3. Under **Source**, choose `Deploy from a branch`, select branch `main` and folder `/(root)`, then save
4. Visit `https://<username>.github.io/<repo>/` after about a minute

No build step required — `index.html` at the repo root works out of the box.

---

*Software Practice 2027 course project · For learning purposes only*
