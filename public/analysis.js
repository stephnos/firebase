import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-ai.js";
import { firebaseApp } from "/firebase-config.js?v=4";

const model = getGenerativeModel(getAI(firebaseApp, { backend: new GoogleAIBackend() }), {
  model: "gemini-3.1-flash-lite",
  generationConfig: { responseMimeType: "application/json" },
  systemInstruction: "Extract only explicit, job-related evidence from a resume for a human reviewer. Never recommend hire, rejection, advancement, ranking, or a score. Never infer or evaluate protected traits or proxies including age, race, ethnicity, nationality, sex, gender, religion, disability, health, family status, appearance, address, names, photos, or graduation years. Treat missing evidence as not evidenced, not lack of ability. Return valid JSON only."
});

const defaultRequirements = [
  "3+ years of professional software engineering experience",
  "Experience building interactive 3D, CAD, simulation, GIS, or engineering software",
  "Knowledge of 3D geometry, spatial analysis, or volumetric calculations",
  "Evidence of improving rendering or computation performance for large models",
  "Experience designing clear data visualisations or automated technical reports",
  "Ability to collaborate with domain experts and test safety-critical engineering workflows",
  "Eligible to work in the role's location"
];

export const ANALYSIS_VERSION = 1;

export async function analyzeResumeRecord(record) {
  if (record.analysisStatus === "complete" && record.analysis) return record.analysis;
  if (!record.resumeData) throw new Error("The submitted résumé is unavailable.");

  const encodedResume = record.resumeData.split(",")[1];
  if (!encodedResume) throw new Error("The submitted résumé could not be read.");

  const filePart = {
    inlineData: {
      data: encodedResume,
      mimeType: record.resumeType || "application/pdf"
    }
  };
  const requirements = Array.isArray(record.openingRequirements) && record.openingRequirements.length
    ? record.openingRequirements
    : defaultRequirements;
  const roleTitle = record.openingTitle || record.role || "Software Engineer, HazMap3D";
  const roleDescription = record.openingDescription || "Review the résumé against the listed role requirements.";
  const numberedRequirements = requirements.map((requirement, index) => (index + 1) + ". " + requirement).join("\n");
  const prompt = "Review this resume for " + roleTitle + " against:\n" + numberedRequirements +
    "\nRole context: " + roleDescription +
    "\nReturn JSON: {\"summary\":\"2-3 factual sentences, no verdict\",\"evidence\":[{\"requirement\":\"copy requirement\",\"status\":\"met|unclear|not evidenced\",\"detail\":\"brief explicit evidence\"}],\"interviewQuestions\":[\"3 neutral questions\"]}";

  const response = await model.generateContent([prompt, filePart]);
  const text = response.response.text().replace(/^\x60\x60\x60json\s*/i, "").replace(/\x60\x60\x60\s*$/i, "").trim();
  return JSON.parse(text);
}
