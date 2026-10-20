import { listenToOpenings } from "/firebase-data.js?v=4";
import { DEFAULT_OPENING } from "/openings.js?v=32";

const openingGrid = document.querySelector("#openingGrid");
const openingCount = document.querySelector("#openingCount");
const careersEmpty = document.querySelector("#careersEmpty");

renderOpenings([DEFAULT_OPENING]);
listenToOpenings(renderOpenings, error => {
  console.error(error);
  renderOpenings([DEFAULT_OPENING]);
});

function renderOpenings(allOpenings) {
  const openings = allOpenings.filter(opening => opening.status === "open");
  const count = openings.length;
  const scale = Math.max(0.74, 1 - Math.max(0, count - 1) * 0.075);

  openingCount.textContent = count + " open role" + (count === 1 ? "" : "s");
  careersEmpty.hidden = count > 0;
  openingGrid.hidden = count === 0;
  openingGrid.dataset.count = String(count);
  openingGrid.style.setProperty("--opening-columns", String(Math.min(Math.max(count, 1), 4)));
  openingGrid.style.setProperty("--opening-card-padding", Math.round(44 * scale) + "px");
  openingGrid.style.setProperty("--opening-title-size", (2.6 * scale).toFixed(2) + "rem");
  openingGrid.style.setProperty("--opening-card-height", Math.round(410 * scale) + "px");
  openingGrid.innerHTML = openings.map((opening, index) =>
    '<a class="career-opening-card" href="/apply?opening=' + encodeURIComponent(opening.id) + '">' +
      '<span class="career-opening-number">' + String(index + 1).padStart(2, "0") + '</span>' +
      '<div class="career-opening-copy"><p>' + escapeHtml(opening.department) + '</p><h3>' + escapeHtml(opening.title) + '</h3><span>' + escapeHtml(opening.description) + '</span></div>' +
      '<div class="career-opening-meta"><span>' + escapeHtml(opening.location) + '</span><span>' + escapeHtml(opening.workType) + '</span><span>' + escapeHtml(opening.employmentType) + '</span><b aria-label="View role">→</b></div>' +
    '</a>'
  ).join("");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;"
  })[character]);
}
