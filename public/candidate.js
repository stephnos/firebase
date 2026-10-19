import { createSharedApplication, listenToOpenings } from "/firebase-data.js?v=4";
import { DEFAULT_OPENING, DEFAULT_OPENING_ID } from "/openings.js?v=32";

const form = document.querySelector("#applicationForm");
const resume = document.querySelector("#candidateResume");
const motivation = form.elements.motivation;
const submitButton = form.querySelector("button[type=submit]");
const openingSelect = document.querySelector("#openingSelect");
const customQuestionFields = document.querySelector("#customQuestionFields");
let openings = [DEFAULT_OPENING];
let selectedOpening = null;

renderOpeningOptions(new URLSearchParams(location.search).get("opening") || DEFAULT_OPENING_ID);
listenToOpenings(allOpenings => {
  const currentId = selectedOpening && selectedOpening.id;
  openings = allOpenings.filter(opening => opening.status === "open");
  renderOpeningOptions(currentId || new URLSearchParams(location.search).get("opening") || DEFAULT_OPENING_ID);
}, error => {
  console.error(error);
  document.querySelector("#successMessage").textContent = "The application service is temporarily unavailable.";
});

openingSelect.addEventListener("change", () => {
  selectOpening(openingSelect.value);
  const url = new URL(location.href);
  url.searchParams.set("opening", openingSelect.value);
  history.replaceState(null, "", url);
});

motivation.addEventListener("input", () => {
  document.querySelector("#charCount").textContent = motivation.value.length;
});

resume.addEventListener("change", async () => {
  const file = resume.files[0];
  if (!file) return;
  if (!(await isPdfFile(file))) {
    clearResumeSelection();
    alert("Please choose a valid PDF file.");
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    clearResumeSelection();
    alert("Please choose a résumé smaller than 3 MB.");
    return;
  }
  document.querySelector("#candidateFileName").textContent = file.name;
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedOpening) {
    alert("There are no open positions accepting applications.");
    return;
  }
  const file = resume.files[0];
  if (!file) return;
  if (!(await isPdfFile(file))) {
    clearResumeSelection();
    alert("Please choose a valid PDF file.");
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    clearResumeSelection();
    alert("Please choose a résumé smaller than 3 MB.");
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Saving application…";

  try {
    const resumeData = await toDataUrl(file);
    const record = {
      id: crypto.randomUUID(),
      firstName: form.elements.firstName.value.trim(),
      lastName: form.elements.lastName.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      sponsorship: form.elements.sponsorship.value,
      portfolio: form.elements.portfolio.value.trim(),
      motivation: motivation.value.trim(),
      customResponses: JSON.stringify(Array.from(form.querySelectorAll("[data-custom-question]")).map(field => ({
        question: field.dataset.question,
        answer: field.value.trim()
      }))),
      resumeName: file.name,
      resumeType: "application/pdf",
      openingId: selectedOpening.id,
      openingTitle: selectedOpening.title,
      status: "New",
      analysisStatus: "pending"
    };

    await createSharedApplication(record, resumeData);
    document.querySelector("#successMessage").textContent = "Your application has been added to the Micropack review queue.";

    document.querySelector("#successName").textContent = record.firstName;
    form.hidden = true;
    document.querySelector("#successCard").hidden = false;
  } catch (error) {
    console.error(error);
    alert("Your application could not be submitted. Please check your connection and try again.");
  } finally {
    submitButton.disabled = !selectedOpening;
    submitButton.querySelector("span").textContent = selectedOpening ? "Submit application" : "No openings available";
  }
});

document.querySelector("#resetApplication").addEventListener("click", () => {
  form.reset();
  if (selectedOpening) openingSelect.value = selectedOpening.id;
  document.querySelector("#charCount").textContent = "0";
  document.querySelector("#candidateFileName").textContent = "Choose a PDF file";
  form.hidden = false;
  document.querySelector("#successCard").hidden = true;
});

function renderOpeningOptions(preferredId) {
  if (!openings.length) {
    selectedOpening = null;
    openingSelect.disabled = true;
    openingSelect.innerHTML = '<option>No open positions</option>';
    document.title = "Careers | Micropack";
    document.querySelector("#jobKicker").textContent = "Micropack careers";
    document.querySelector("#jobTitle").textContent = "No openings right now";
    document.querySelector("#jobDescription").textContent = "Please check back for future opportunities.";
    document.querySelector("#jobLocation").textContent = "Not available";
    document.querySelector("#jobType").textContent = "Not available";
    document.querySelector("#jobTeam").textContent = "Micropack";
    document.querySelector("#motivationLabel").textContent = "Why are you interested in working at Micropack? *";
    renderCustomQuestions([]);
    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = "No openings available";
    return;
  }
  openingSelect.disabled = false;
  openingSelect.innerHTML = openings.map(opening =>
    '<option value="' + escapeAttribute(opening.id) + '">' + escapeHtml(opening.title) + " · " + escapeHtml(opening.location) + "</option>"
  ).join("");
  const opening = openings.find(item => item.id === preferredId) || openings[0];
  if (!opening) return;
  openingSelect.value = opening.id;
  selectOpening(opening.id);
  if (!form.hidden) {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Submit application";
  }
}

function selectOpening(id) {
  selectedOpening = openings.find(opening => opening.id === id) || openings[0];
  if (!selectedOpening) return;
  document.title = selectedOpening.title + " | Micropack";
  document.querySelector("#jobKicker").textContent = selectedOpening.department + " · " + selectedOpening.location;
  document.querySelector("#jobTitle").textContent = selectedOpening.title;
  document.querySelector("#jobDescription").textContent = selectedOpening.description;
  document.querySelector("#jobLocation").textContent = [selectedOpening.location, selectedOpening.workType].filter(Boolean).join(" · ");
  document.querySelector("#jobType").textContent = selectedOpening.employmentType || "Full-time";
  document.querySelector("#jobTeam").textContent = selectedOpening.department;
  document.querySelector("#motivationLabel").textContent = "Why are you interested in the " + selectedOpening.title + " role? *";
  renderCustomQuestions(selectedOpening.customQuestions);
}

function renderCustomQuestions(questions) {
  const validQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];
  customQuestionFields.innerHTML = validQuestions.map((question, index) =>
    '<label><span>' + escapeHtml(question) + ' *</span><textarea name="customQuestion' + index + '" data-custom-question data-question="' +
      escapeAttribute(question) + '" rows="4" required maxlength="1200" placeholder="Your answer..."></textarea></label>'
  ).join("");
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, "data:application/pdf;base64,"));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function isPdfFile(file) {
  if (!/\.pdf$/i.test(file.name)) return false;
  return await file.slice(0, 5).text() === "%PDF-";
}

function clearResumeSelection() {
  resume.value = "";
  document.querySelector("#candidateFileName").textContent = "Choose a PDF file";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[character]);
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}
