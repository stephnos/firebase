export const OPENINGS_STORAGE_KEY = "micropack-openings";
export const DEFAULT_OPENING_ID = "software-engineer-hazmap3d";
export const DEFAULT_APPLICATION_QUESTIONS = [
  "First name",
  "Last name",
  "Email address",
  "Phone number",
  "LinkedIn or portfolio",
  "Why are you interested in this role?",
  "Résumé",
  "Will you now or in the future require employer sponsorship to work in this role's location?"
];

const DEFAULT_HAZMAP3D_QUESTIONS = [
  "Describe a 3D, CAD, GIS, simulation, or engineering software feature you have built.",
  "How have you tested software used in safety-critical or high-consequence engineering workflows?"
];

export const DEFAULT_OPENING = {
  id: DEFAULT_OPENING_ID,
  title: "Software Engineer, HazMap3D",
  department: "Engineering",
  location: "Aberdeen",
  workType: "Hybrid",
  employmentType: "Full-time",
  description: "Build the 3D modelling software fire and gas engineers use to design safer industrial environments.",
  requirements: [
    "3+ years of professional software engineering experience",
    "Experience building interactive 3D, CAD, simulation, GIS, or engineering software",
    "Knowledge of 3D geometry, spatial analysis, or volumetric calculations",
    "Evidence of improving rendering or computation performance for large models",
    "Experience designing clear data visualisations or automated technical reports",
    "Ability to collaborate with domain experts and test safety-critical engineering workflows",
    "Eligible to work in the role's location"
  ],
  customQuestions: DEFAULT_HAZMAP3D_QUESTIONS,
  status: "open",
  createdAt: "2026-08-22T00:00:00.000Z"
};

export function readOpenings() {
  try {
    const stored = JSON.parse(localStorage.getItem(OPENINGS_STORAGE_KEY) || "[]");
    const openings = Array.isArray(stored) ? stored.filter(isValidOpening).map(normalizeOpening) : [];
    if (!openings.some(opening => opening.id === DEFAULT_OPENING_ID)) openings.unshift(DEFAULT_OPENING);
    return openings;
  } catch {
    return [DEFAULT_OPENING];
  }
}

export function saveOpenings(openings) {
  localStorage.setItem(OPENINGS_STORAGE_KEY, JSON.stringify(openings));
}

export function createOpening(values) {
  const title = String(values.title || "").trim();
  return {
    id: slugify(title) + "-" + crypto.randomUUID().slice(0, 8),
    title,
    department: String(values.department || "").trim(),
    location: String(values.location || "").trim(),
    workType: String(values.workType || "").trim(),
    employmentType: String(values.employmentType || "").trim(),
    description: String(values.description || "").trim(),
    requirements: String(values.requirements || "").split("\n").map(value => value.trim()).filter(Boolean),
    customQuestions: String(values.customQuestions || "").split("\n").map(value => value.trim()).filter(Boolean),
    status: "open",
    createdAt: new Date().toISOString()
  };
}

function isValidOpening(opening) {
  return opening && typeof opening.id === "string" && typeof opening.title === "string";
}

export function normalizeOpening(opening) {
  const fallbackQuestions = opening.id === DEFAULT_OPENING_ID ? DEFAULT_HAZMAP3D_QUESTIONS : [];
  return {
    ...opening,
    requirements: Array.isArray(opening.requirements) ? opening.requirements : [],
    customQuestions: Array.isArray(opening.customQuestions) ? opening.customQuestions : fallbackQuestions
  };
}

function slugify(value) {
  return String(value || "opening").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-") || "opening";
}
