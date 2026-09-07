import { hitCounter } from "./api.js";

// Bump the counter once per page load and show the total in the footer as a
// split-flap "airport board" of black tiles. Purely cosmetic — if it fails,
// stay hidden rather than nag the visitor.
document.addEventListener("DOMContentLoaded", async () => {
  const el = document.getElementById("visitorCount");
  if (!el) return;
  try {
    const { hits } = await hitCounter();
    const digits = String(hits).padStart(6, "0");

    el.textContent = "";
    const board = document.createElement("span");
    board.className = "counter-board";
    for (const ch of digits) {
      const tile = document.createElement("span");
      tile.className = "counter-tile";
      tile.textContent = ch; // SAFE: single char from a number, not HTML
      board.appendChild(tile);
    }
    el.appendChild(board);

    el.hidden = false;
  } catch {
    // leave hidden
  }
});
