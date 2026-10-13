import { ANALYSIS_VERSION, analyzeResumeRecord } from "/analysis.js?v=19";
import {
  deleteSharedApplication,
  ensureDefaultOpening,
  listenToApplications,
  listenToOpenings,
  loadSharedResume,
  saveSharedOpening,
  updateSharedApplication
} from "/firebase-data.js?v=4";
import { DEFAULT_APPLICATION_QUESTIONS, DEFAULT_OPENING, DEFAULT_OPENING_ID, createOpening } from "/openings.js?v=32";

const $ = selector => document.querySelector(selector);
let applications = [];
let selected = null;
let openings = [DEFAULT_OPENING];
let selectedOpeningId = new URLSearchParams(location.search).get("opening") || DEFAULT_OPENING_ID;
const analysisInFlight = new Set();
const deletedApplicationIds = new Set();
const resumeCache = new Map();

function renderInbox() {
  const visibleApplications = applications.filter(item => applicationOpeningId(item) === selectedOpeningId);
  $("#applicationCount").textContent = visibleApplications.length + " application" + (visibleApplications.length === 1 ? "" : "s");
  $("#newCount").textContent = visibleApplications.filter(item => item.status === "New").length + " new";
  $("#inboxEmpty").hidden = visibleApplications.length > 0;
  $("#applicationList").innerHTML = visibleApplications.map(item =>
    '<button class="application-row ' + (selected && selected.id === item.id ? "active" : "") + '" data-id="' + esc(item.id) + '">' +
      '<span class="avatar">' + esc((item.firstName[0] || "") + (item.lastName[0] || "")) + '</span>' +
      '<span><b>' + esc(item.firstName) + " " + esc(item.lastName) + '</b><small>' +
      dateFromFirestore(item.submittedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " + esc(item.status || "New") +
      '</small></span><i>→</i></button>'
  ).join("");
  document.querySelectorAll("[data-id]").forEach(button => {
    button.addEventListener("click", () => selectApplication(button.dataset.id));
  });
}

function renderOpeningControls() {
  const current = openings.find(opening => opening.id === selectedOpeningId) || openings[0];
  if (!current) return;
  selectedOpeningId = current.id;
  $("#openingFilter").innerHTML = openings.map(opening =>
    '<option value="' + esc(opening.id) + '">' + esc(opening.title) + (opening.status === "open" ? "" : " (Closed)") + "</option>"
  ).join("");
  $("#openingFilter").value = current.id;
  $("#openingMeta").textContent = [current.location, current.workType, current.status === "open" ? "Open" : "Closed"].filter(Boolean).join(" · ");
  $("#openingApplyLink").href = "/apply?opening=" + encodeURIComponent(current.id);
  $("#inboxApplicationLink").href = "/apply?opening=" + encodeURIComponent(current.id);
  $("#openingApplyLink").hidden = current.status !== "open";
  $("#toggleOpeningStatus").textContent = current.status === "open" ? "Close opening" : "Reopen opening";
  $("#toggleOpeningStatus").classList.toggle("danger", current.status === "open");
  $("#toggleOpeningStatus").classList.toggle("reopen", current.status !== "open");
}

function switchOpening(id) {
  const current = openings.find(opening => opening.id === id) || openings[0];
  if (!current) return;
  selectedOpeningId = current.id;
  selected = null;
  $("#candidateReview").hidden = true;
  $("#reviewEmpty").hidden = false;
  renderOpeningControls();
  renderInbox();
  const firstApplication = applications.find(item => applicationOpeningId(item) === selectedOpeningId);
  if (firstApplication) selectApplication(firstApplication.id);
  const url = new URL(location.href);
  url.searchParams.set("opening", selectedOpeningId);
  history.replaceState(null, "", url);
}

