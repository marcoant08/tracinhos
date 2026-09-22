---
name: Tracinhos
description: Party-game lobby at Kahoot craft — navy field, paper board, electric yellow shout.
colors:
  bg: "#14264f"
  bg-2: "#1d3570"
  navy-wash: "#2a4a92"
  paper: "#f4efe4"
  ink: "#141820"
  text: "#f4f1ea"
  muted: "#b7c4ea"
  line: "#3a5290"
  cta: "#ffe14a"
  danger: "#ff5a6a"
  nick-ink: "#fffaf0"
  board-stroke: "#2b2118"
  board-grid: "#e6d7c2"
  player-red: "#d64545"
  player-blue: "#2f6fed"
  player-green: "#2f9e5f"
  player-yellow: "#d4a017"
  player-purple: "#7b4fc7"
  player-orange: "#e06b20"
  player-teal: "#1f8a8a"
  player-pink: "#d4539b"
typography:
  display:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(2.8rem, 9vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 0.88
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Anton, sans-serif"
    fontSize: "1.7rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.02em"
  title:
    fontFamily: "Anton, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.16em"
  body:
    fontFamily: "Sora, Segoe UI, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
  label:
    fontFamily: "Sora, Segoe UI, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  field: "14px"
  pad: "16px"
  tile: "18px"
  action: "20px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  2xl: "28px"
  3xl: "40px"
  split: "56px"
components:
  button-primary:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "0 20px"
    height: "72px"
    width: "100%"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.action}"
    padding: "0 20px"
    height: "72px"
    width: "100%"
  input:
    backgroundColor: "{colors.bg-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "48px"
    width: "100%"
  select-size:
    backgroundColor: "{colors.bg-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "56px"
    width: "100%"
  color-pad:
    backgroundColor: "{colors.player-red}"
    rounded: "{rounded.pad}"
    height: "58px"
    width: "100%"
  toast:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  turn-you:
    textColor: "{colors.cta}"
    typography: "{typography.display}"
  site-title:
    textColor: "{colors.text}"
    typography: "{typography.display}"
---

# Design System: Tracinhos

## Overview

**Creative North Star: "Night Living-Room Phones"**

Tracinhos is a category-standard party-game lobby executed at Kahoot craft: oversized actions, an unmissable turn, and a nick list that reads as people in the room. The field is a night living-room navy; the board is the paper table; electric yellow is the shout that starts a match and owns your turn. It refuses a timid dark-card stack and refuses school, notebook, or lined-paper costume.

Sora carries every UI sentence. Anton is reserved for the shout — wordmark, room code, SUA VEZ / Vez de X, timer numerals, and the result title. Controls sit directly on the navy field. The only lifted object in play is the paper board.

**Key Characteristics:**
- Navy field with a ceiling wash; no nested cards
- Electric yellow on primary actions and SUA VEZ, never as a player pad
- Anton shout + Sora UI
- Eight player colors as fat pads and full-bleed nick tiles
- Paper board as the table, with the deepest lift
- Color is never the only identity or turn signal

## Colors

A dark navy room, one electric accent, a warm paper table, and eight fat player colors. No second chrome accent.

### Primary
- **Electric Yellow**: The start button, SUA VEZ, timer numerals, wordmark stroke, text links, toasts, and the focus ring. Rarity is not the point — unmissability is. It is not a player color.

### Neutral
- **Night Navy**: Full-viewport field and `themeColor`. A ceiling wash (`navy-wash`) sits at the top of the body; it is atmosphere, not a card.
- **Shelf Navy**: Recessed fields — the only darker inset on the field.
- **Navy Line**: Field borders and the timer track.
- **Warm Paper**: Default type on navy.
- **Periwinkle Mute**: Labels, lede, rules body, hints.
- **Ink**: Type on yellow; board-dot stroke; yellow-player nick type.
- **Paper Board**: The play surface fill. The only large light plane.
- **Nick Cream**: Type on every player tile except yellow.
- **Board Stroke / Board Grid**: Drawn vs empty edges on the paper.

### Player identity
Eight stable ids (`red` `blue` `green` `yellow` `purple` `orange` `teal` `pink`). They fill color pads, nick tiles, score rows, claimed squares (at 45% on paper), and the color core of a drawn stroke. Yellow-player type uses ink; every other tile uses nick cream.

### Named Rules
**The Electric Shout Rule.** Electric yellow starts the match and owns SUA VEZ. It never fills a player pad and never paints the navy field.

**The Fat Pad Rule.** Player color is a filled rounded pad or a full-bleed nick tile — never a thin swatch, outline chip, or text-only tint.

**The Never-Color-Alone Rule.** Identity and turn always carry nick, and turn also carries 👈 plus `aria-current`. Color is a partner, not the signal.

## Typography

**Display Font:** Anton (sans-serif fallback)
**Body Font:** Sora (Segoe UI, system-ui)

**Character:** Anton is a compressed party shout — uppercase, tight leading, wide tracking only on the room code. Sora is the living-room UI: heavy labels and nicks, readable rules.

### Hierarchy
- **Display** (400, wordmark clamp, line-height 0.88, uppercase): Site title plus the yellow stroke mark.
- **Headline** (400, 1.7rem, uppercase, 0.02em): Section shouts — Criar sala, Entrar, Regras page title at 2rem.
- **Title** (400, 2.6rem, uppercase, 0.16em / 0.18em on the desktop code field): Room code, results title, timer numerals at 2.35rem.
- **Body** (400, 1.05rem / 1.35rem on desktop lede, line-height 1.35–1.45): Lede, rules, waiting copy. Lede max-width 28ch (42ch on desktop).
- **Label** (700, 0.82rem): Field labels in periwinkle mute. Nicks and primary button labels jump to 800 at 1.25–1.45rem (1.85rem on desktop Criar).

Play HUD: SUA VEZ is Anton at `clamp(2.6rem, 11vw, 3.6rem)` in electric yellow. “Vez de {nick}” stays Anton at `clamp(1.85rem, 7vw, 2.6rem)` in warm paper. The hint under the shout drops to Sora 0.72rem / 600, sentence case.

### Named Rules
**The Anton Shout Rule.** Anton is wordmark, room code, section shout, SUA VEZ / Vez de X, timer numerals, and VENCEU / EMPATE. Every other sentence is Sora.

## Layout

Mobile-first column. Content pages cap at 720px (1080px from 960px) with 20px gutters (40px on desktop). The play column is `min(560px, 100%)` (640px on desktop), HUD fixed, board filling the rest. Safe-area insets sit on the body.

Lobby from 960px is a two-column grid (`1.35fr / 0.9fr`, 56px gap): Criar sala owns the stage; Entrar is the second beat. Lede and the regras link span both columns. Desktop Criar is 92px / 1.85rem; color pads grow to 72px; the code field is a 92px Anton stack.

Rhythm: 6px under labels, 8–10px between fields and tiles, 14px in the HUD, 20/28/40px around beats. Touch targets stay ≥ 44px; fields 48px, size select 56px, actions 72px.

**The No Nested Cards Rule.** Controls sit on the navy field. No card wraps a card; no dark panel stacks the lobby.

## Elevation & Depth

The navy field is flat except for the ceiling wash. Depth is a short drop on selected pads and nick tiles, and a deep drop under the paper board. Turn uses a 3px electric ring on the current score row, a 4px blinking board border, and a one-second radial flash — not a hover shadow. No offset neobrutalist shadow.

### Shadow Vocabulary
- **Pad selected** (`0 6px 16px rgba(0, 0, 0, 0.35)`): Chosen color pad, plus a 3px warm-paper border.
- **Nick tile** (`0 8px 18px rgba(0, 0, 0, 0.28)`): Lobby list, score rows, winner pills.
- **Turn ring** (`0 0 0 3px` electric yellow) stacked on the nick-tile drop: current player only.
- **Paper board** (`0 18px 40px rgba(0, 0, 0, 0.45)`): The table.
- **Toast** (`0 10px 28px rgba(0, 0, 0, 0.4)`): Transient notice.

### Named Rules
**The Paper Lift Rule.** The board is the only deeply lifted object. Nick tiles get a short drop. The navy field stays flat.

## Shapes

Generous continuous radii, never sharp, never a stadium except a leftover unused chip. Fields 14px; pads and score rows 16px; lobby tiles and the board-turn frame 18px; primary actions and the paper board 20px. Dots are circles (22–28px in chrome, 7–10px on the board). The wordmark stroke is two dots and a bar — the same geometry as the score-stroke mark.

**The Fat Radius Rule.** Actions 20px, pads 16px, fields 14px. Do not square them; do not pill the primary button.

## Components

Tactile and unmissable: fat yellow start, fat color pads, living nick tiles, a paper table.

### Buttons
- **Shape:** Continuous 20px capsule-rectangle, full width, 72px tall.
- **Primary:** Electric yellow, ink type, 800 / 1.45rem (desktop Criar 92px / 1.85rem). Press: scale 0.97 and brightness 0.92 in 120ms (`cubic-bezier(0.16, 1, 0.3, 1)`). Disabled: 40% opacity.
- **Ghost:** Transparent, 2px navy-line border, warm-paper type. Secondary actions (copy link, add bot). Not the visual default for starting a match.
- **Focus:** 3px electric outline, 2px offset — the global `:focus-visible`.

### Color pads
- **Style:** 4-across grid, 8px gap, 58px tall (72px desktop), 16px radius, filled with a player hex.
- **Selected:** 3px warm-paper border plus the pad-selected drop.
- **Taken:** 35% opacity and a navy slash through the pad.

### Cards / Containers
There is no card component. Sections are headlines plus fields on the navy field. Nick tiles and the paper board are the only filled surfaces.

### Inputs / Fields
- **Style:** Shelf-navy fill, 2px navy-line border, 14px radius, 48px tall, 14px horizontal pad.
- **Size select:** Same shell at 56px, 1.15rem / 700.
- **Code field (desktop):** Anton title tracking, 92px tall, centered uppercase.
- **Focus:** Global electric ring. Caret is electric yellow.
- **Placeholder:** A lighter periwinkle (`#8ea0d4`) — one-off, not a token.

### Navigation
The site title is the only chrome: Anton display, uppercase, 44px min height, yellow score-stroke mark. Hidden on the play viewport. Regras is an underlined 700 electric text link (4px underline offset), never a card.

### Nick tiles
Full-bleed player hex, 16–18px radius, nick-tile drop, 800 type (1.25rem in the score list, 1.35rem in the lobby). Yellow tiles use ink; others use nick cream. Current turn adds the electric ring and 👈. Host/bot are a suffix on the nick (`· host`, `· bot`), not a badge.

### Play HUD
SUA VEZ (or Vez de {nick}) beside a 96px electric timer ring. Score rows stack under it. The paper board fills the remaining column.

### Paper board
Warm paper, 20px radius, paper-lift shadow. Idle dots: white fill, ink stroke. Selected origin: player-blue fill, blink. Targets blink. Empty edges use board-grid at 2px; drawn edges are a 6px board-stroke bar with a 2.5px player-color core. Claimed squares tint at 45%. Your-turn border is 4px `currentColor`, 18px radius, 1s blink. Reduced motion cancels blinks and presses.

### Toast
Electric yellow, ink type, 14px radius, 700 / 0.92rem, top-right, toast drop.

## Do's and Don'ts

### Do:
- **Do** shout SUA VEZ in Anton + electric yellow, with a Sora hint underneath.
- **Do** fill pads and nick tiles from the eight player hexes; pair every color with a nick.
- **Do** keep the paper board as the only table on the navy field.
- **Do** size the primary action at 72px (92px for desktop Criar) in electric yellow.

### Don't:
- **Don't** wrap the lobby in nested dark cards or a timid card stack.
- **Don't** dress any surface as school, notebook, or lined paper.
- **Don't** set UI sentences in Anton, or the wordmark / code / SUA VEZ in Sora.
- **Don't** use electric yellow as a player pad, or player yellow as the CTA.
- **Don't** mark identity or turn with color alone.
- **Don't** add kickers, eyebrows, or a results eyebrow.
