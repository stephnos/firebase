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

function applicationOpeningId(application) {
  return application.openingId || DEFAULT_OPENING_ID;
}

async function selectApplication(id) {
  selected = applications.find(item => item.id === id);
  if (!selected) return;

  $("#reviewEmpty").hidden = true;
  $("#candidateReview").hidden = false;
  $("#candidateName").textContent = selected.firstName + " " + selected.lastName;
  $("#candidateEmail").textContent = selected.email;
  $("#candidateEmail").href = "mailto:" + selected.email;
  $("#appliedDate").textContent = dateFromFirestore(selected.submittedAt).toLocaleString();
  $("#resumeName").textContent = selected.resumeName;
  $("#resumeFileLabel").textContent = selected.resumeName || "Document preview";
  $("#motivationText").textContent = selected.motivation;
  $("#applicationStatus").textContent = selected.status || "New";
  const portfolioUrl = safeExternalUrl(selected.portfolio);
  $("#portfolioLink").hidden = !portfolioUrl;
  $("#portfolioLink").href = portfolioUrl || "#";
  $("#decisionNote").textContent = selected.decision ? selected.decision + " · recorded by reviewer" : "No decision recorded.";

  document.querySelectorAll("[data-decision]").forEach(button => {
    button.classList.toggle("selected", button.dataset.decision === selected.decision);
  });

  if (resumeCache.has(id)) selected.resumeData = resumeCache.get(id);
  renderResume(selected);
  renderApplicationAnswers(selected);
  renderAnalysisState(selected);
  renderInbox();
  if (!selected.resumeData) {
    try {
      const resumeData = await loadSharedResume(id);
      if (!resumeData) throw new Error("The submitted résumé is unavailable.");
      resumeCache.set(id, resumeData);
      const current = applications.find(item => item.id === id);
      if (current) current.resumeData = resumeData;
      if (!selected || selected.id !== id) return;
      selected.resumeData = resumeData;
      renderResume(selected);
    } catch (error) {
      console.error(error);
      showError("The submitted résumé could not be loaded.");
      return;
    }
  }
  void ensureAnalysis(id);
}

function renderResume(record) {
  const frame = $("#resumeFrame");
  const textPreview = $("#resumeText");
  const openLink = $("#resumeOpen");
  const isPdf = /pdf/i.test(record.resumeType || "") || /\.pdf$/i.test(record.resumeName || "");
  const isText = /text|markdown/i.test(record.resumeType || "") || /\.(txt|md)$/i.test(record.resumeName || "");

  openLink.href = record.resumeData || "#";
  openLink.setAttribute("download", record.resumeName || "resume");
  openLink.hidden = !record.resumeData;
  frame.hidden = true;
  textPreview.hidden = true;
  frame.removeAttribute("src");
  textPreview.textContent = "";

  if (!record.resumeData) {
    textPreview.textContent = "Résumé preview unavailable.";
    textPreview.hidden = false;
  } else if (isPdf) {
    frame.src = record.resumeData;
    frame.hidden = false;
  } else if (isText) {
    textPreview.textContent = decodeTextDataUrl(record.resumeData);
    textPreview.hidden = false;
  } else {
    textPreview.textContent = "Preview is not available for this file type. Use the download link to open the résumé.";
    textPreview.hidden = false;
  }
}

function renderApplicationAnswers(record) {
  const customResponses = parseCustomResponses(record.customResponses);
  const responses = [
    {
      question: "Will you now or in the future require employer sponsorship to work in this role's location?",
      answer: record.sponsorship || "Not answered"
    },
    ...customResponses
  ];
  $("#applicationAnswerList").innerHTML = responses.map(response =>
    '<article><b>' + esc(response.question) + '</b><p>' + esc(response.answer || "Not answered") + '</p></article>'
  ).join("");
}

function parseCustomResponses(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderAnalysisState(record) {
  const statusText = $("#analysisStatusText");
  $("#analysisResults").hidden = true;
  $("#errorBox").hidden = true;

  if (record.analysisStatus === "complete" && record.analysis) {
    statusText.textContent = "Generated for the admin review and saved with this application.";
    renderAnalysis(record.analysis);
    return;
  }

  if (record.analysisStatus === "processing") {
    statusText.textContent = "Generating and saving Gemini feedback now.";
    return;
  }

  if (record.analysisStatus === "failed") {
    statusText.textContent = "Gemini feedback is missing, so it will be generated automatically.";
    showError(record.analysisError || "Gemini analysis failed.");
    return;
  }

  statusText.textContent = "Gemini feedback is missing, so it is being generated automatically.";
}

async function ensureAnalysis(id) {
  let record = applications.find(item => item.id === id);
  if (!record || !record.resumeData || record.analysisStatus === "complete" && record.analysis || analysisInFlight.has(id)) return;

  const startedAt = Date.parse(record.analysisStartedAt || "");
  const anotherTabIsWorking = record.analysisStatus === "processing" && Number.isFinite(startedAt) && Date.now() - startedAt < 30000;
  if (anotherTabIsWorking) return;

  analysisInFlight.add(id);
  const opening = openings.find(item => item.id === applicationOpeningId(record));
  if (opening && !record.openingTitle) {
    record.openingId = opening.id;
    record.openingTitle = opening.title;
    record.openingDepartment = opening.department;
    record.openingLocation = opening.location;
    record.openingDescription = opening.description;
    record.openingRequirements = opening.requirements;
    record.role = opening.title;
  }
  record.analysisStatus = "processing";
  record.analysisStartedAt = new Date().toISOString();
  record.analysisVersion = ANALYSIS_VERSION;
  record.analysisError = "";
  await updateSharedApplication(id, {
    analysisStatus: record.analysisStatus,
    analysisStartedAt: record.analysisStartedAt,
    analysisVersion: record.analysisVersion,
    analysisError: ""
  });
  if (selected && selected.id === id) renderAnalysisState(record);
  try {
    record.analysis = await analyzeResumeRecord(record);
    if (deletedApplicationIds.has(id)) return;
    record.analysisStatus = "complete";
    record.analysisGeneratedAt = new Date().toISOString();
    record.analysisError = "";
    await updateSharedApplication(id, {
      analysis: record.analysis,
      analysisStatus: record.analysisStatus,
      analysisGeneratedAt: record.analysisGeneratedAt,
      analysisError: ""
    });
  } catch (error) {
    if (deletedApplicationIds.has(id)) return;
    console.error(error);
    record.analysisStatus = "failed";
    record.analysisError = friendlyAnalysisError(error);
    await updateSharedApplication(id, {
      analysisStatus: record.analysisStatus,
      analysisError: record.analysisError
    });
  } finally {
    analysisInFlight.delete(id);
    deletedApplicationIds.delete(id);
    if (selected && selected.id === id) {
      selected = record;
      renderAnalysisState(record);
    }
  }
}

function renderAnalysis(data) {
  $("#summary").textContent = data.summary || "No summary returned.";
  $("#evidenceList").innerHTML = (data.evidence || []).map(item => {
    const status = ["met", "unclear", "not evidenced"].includes(item.status) ? item.status : "unclear";
    return '<article class="evidence-item ' + status.replace(" ", "-") + '"><span class="badge">' +
      esc(status) + '</span><div><h4>' + esc(item.requirement) + '</h4><p>' + esc(item.detail) + '</p></div></article>';
  }).join("");
  $("#questions").innerHTML = (data.interviewQuestions || []).map(question => "<li>" + esc(question) + "</li>").join("");
  $("#analysisResults").hidden = false;
  $("#errorBox").hidden = true;
}

$("#openingFilter").addEventListener("change", event => switchOpening(event.target.value));
$("#toggleOpeningStatus").addEventListener("click", async () => {
  const opening = openings.find(item => item.id === selectedOpeningId);
  if (!opening) return;
  const closing = opening.status === "open";
  if (closing && !window.confirm("Close this opening? Existing applications will remain available, but new applications will stop.")) return;
  opening.status = closing ? "closed" : "open";
  opening.statusChangedAt = new Date().toISOString();
  await saveSharedOpening(opening);
  switchOpening(opening.id);
});
$("#showOpeningForm").addEventListener("click", () => toggleOpeningForm(true));
$("#closeOpeningForm").addEventListener("click", () => toggleOpeningForm(false));
$("#cancelOpeningForm").addEventListener("click", () => toggleOpeningForm(false));

$("#newOpeningForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const opening = createOpening(Object.fromEntries(new FormData(form).entries()));
  if (!opening.requirements.length) {
    form.elements.requirements.setCustomValidity("Enter at least one job-related requirement.");
    form.elements.requirements.reportValidity();
    return;
  }
  form.elements.requirements.setCustomValidity("");
  await saveSharedOpening(opening);
  if (!openings.some(item => item.id === opening.id)) openings.push(opening);
  form.reset();
  toggleOpeningForm(false);
  switchOpening(opening.id);
});

$("#newOpeningForm").elements.requirements.addEventListener("input", event => {
  event.target.setCustomValidity("");
});

function toggleOpeningForm(show) {
  $("#newOpeningPanel").hidden = !show;
  if (show) $("#newOpeningForm").elements.title.focus();
}

async function deleteApplication(id) {
  const analysisWasInFlight = analysisInFlight.has(id);
  deletedApplicationIds.add(id);
  resumeCache.delete(id);
  try {
    await deleteSharedApplication(id);
  } catch (error) {
    deletedApplicationIds.delete(id);
    throw error;
  }
  applications = applications.filter(application => application.id !== id);
  if (!analysisWasInFlight) deletedApplicationIds.delete(id);
  selected = null;
  $("#candidateReview").hidden = true;
  $("#reviewEmpty").hidden = false;
  renderInbox();
  const nextApplication = applications.find(application => applicationOpeningId(application) === selectedOpeningId);
  if (nextApplication) selectApplication(nextApplication.id);
}

document.querySelectorAll("[data-decision]").forEach(button => {
  button.addEventListener("click", async () => {
    if (!selected) return;
    if (button.dataset.decision === "Close application") {
      const candidateName = selected.firstName + " " + selected.lastName;
      const confirmed = window.confirm(
        "Permanently delete " + candidateName + "'s application, résumé, answers and Gemini feedback? This cannot be undone."
      );
      if (!confirmed) return;
      const applicationId = selected.id;
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = "Deleting…";
      $("#decisionNote").textContent = "Deleting this application and its résumé permanently.";
      try {
        await deleteApplication(applicationId);
      } catch (error) {
        console.error(error);
        button.disabled = false;
        button.textContent = originalLabel;
        $("#decisionNote").textContent = "Deletion failed. Your account may not have permission, or the connection was interrupted. Please try again.";
      }
      return;
    }
    selected.decision = button.dataset.decision;
    selected.status = button.dataset.decision;
    await updateSharedApplication(selected.id, {
      decision: selected.decision,
      status: selected.status
    });
    document.querySelectorAll("[data-decision]").forEach(item => item.classList.remove("selected"));
    button.classList.add("selected");
    $("#applicationStatus").textContent = selected.status;
    $("#decisionNote").textContent = selected.decision + " · recorded by reviewer";
    renderInbox();
  });
});

function handleOpenings(nextOpenings) {
  openings = nextOpenings;
  const current = openings.find(opening => opening.id === selectedOpeningId) || openings[0];
  if (!current) return;
  selectedOpeningId = current.id;
  renderOpeningControls();
  renderInbox();
}

function handleApplications(nextApplications) {
  const selectedId = selected && selected.id;
  applications = nextApplications.map(application => ({
    ...application,
    ...(resumeCache.has(application.id) ? { resumeData: resumeCache.get(application.id) } : {})
  }));
  renderInbox();
  if (selectedId && applications.some(item => item.id === selectedId && applicationOpeningId(item) === selectedOpeningId)) {
    void selectApplication(selectedId);
    return;
  }
  const firstApplication = applications.find(item => applicationOpeningId(item) === selectedOpeningId);
  if (firstApplication) void selectApplication(firstApplication.id);
  else {
    selected = null;
    $("#candidateReview").hidden = true;
    $("#reviewEmpty").hidden = false;
  }
}

function showSharedDataError(error) {
  console.error(error);
  $("#inboxEmpty").hidden = false;
  $("#inboxEmpty p").textContent = "The shared application inbox could not be loaded. Please refresh and try again.";
}

async function initializeSharedAdmin() {
  try {
    await ensureDefaultOpening();
    listenToOpenings(handleOpenings, showSharedDataError);
    listenToApplications(handleApplications, showSharedDataError);
  } catch (error) {
    showSharedDataError(error);
  }
}

function decodeTextDataUrl(dataUrl) {
  try {
    const encoded = dataUrl.split(",")[1] || "";
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "The résumé text could not be previewed.";
  }
}

function dateFromFirestore(value) {
  const date = value && typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function friendlyAnalysisError(error) {
  const message = String(error && error.message || error);
  return /api|permission|403|not found|fetch/i.test(message)
    ? "Gemini could not be reached. Check Firebase AI Logic and try again."
    : message;
}

function showError(message) {
  $("#errorBox").hidden = false;
  $("#errorMessage").textContent = message;
}

function esc(value = "") {
  return String(value).replace(/[&<>"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[character]);
}

$("#defaultQuestionList").innerHTML = DEFAULT_APPLICATION_QUESTIONS.map(question => "<span>" + esc(question) + "</span>").join("");
renderOpeningControls();
switchOpening(selectedOpeningId);
void initializeSharedAdmin();
