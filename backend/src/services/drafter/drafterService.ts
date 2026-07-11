/**
 * drafterService.ts
 * Multi-turn conversational pipeline for MoU / LoI / PKS document drafting.
 *
 * Per turn:
 *  1. Classify document intent (MoU | LoI | PKS)
 *  2. Check for binding MoU warnings (price/penalty terms)
 *  3. Extract structured fields from conversation
 *  4. If fields incomplete → return clarifying questions
 *  5. Fetch ClauseTemplate nodes from Neo4j
 *  6. Assemble and return the final markdown document
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";
import { getSession } from "../../config/neo4j";
import { generateDraftPdf } from "./pdfService";

const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

// Types

export type DocumentType = "LoI" | "MoU" | "PKS";
export type DrafterStatus = "needs_clarification" | "draft_ready" | "error";

export interface ConversationTurn {
  role: "user" | "assistant" | "model";
  content: string;
}

export interface DrafterRequest {
  session_id: string;
  message: string;
  history?: ConversationTurn[];
  userId?: string; // set from JWT auth
}

export interface DrafterResponse {
  status: DrafterStatus;
  document_type?: DocumentType;
  binding_warning?: boolean;
  clarifying_questions?: string[];
  draft?: string;
  document_number?: string;
  pdf_base64?: string; // base64-encoded PDF (only when status === "draft_ready")
  action_buttons?: string[]; // ["Accept", "Revise"] (only when status === "draft_ready")
  guardrail?: {
    is_safe: boolean;
    warning_count: number;
    critical_violations: unknown[];
  };
}

interface ExtractedFields {
  party_a_name?: string;
  party_a_details?: string;
  party_b_name?: string;
  party_b_details?: string;
  scope?: string;
  duration?: string;
  value?: string;
  payment_terms?: string;
  penalty?: string;
  jurisdiction?: string;
  [key: string]: string | undefined;
}

// Utility

function generateDocumentNumber(type: DocumentType): string {
  const now = new Date();
  const romanMonths = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];
  const month = romanMonths[now.getMonth()];
  const year = now.getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `${type}/${seq}/${month}/${year}`;
}

function hasBindingTerms(text: string): boolean {
  return /(?:harga|nilai|pembayaran|biaya)\s+Rp|denda\s+\d|penalti\s+\d|penalty.*\d+%/i.test(
    text,
  );
}

// Step 1: Classify intent

async function classifyIntent(
  message: string,
  history: ConversationTurn[],
): Promise<DocumentType> {
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });
  const historyText = history
    .slice(-4)
    .map((h) => `${h.role === "user" ? "Pengguna" : "CLARA"}: ${h.content}`)
    .join("\n");

  const prompt = `Based on the following conversation, determine the type of document the user wants to create.
Options: MoU (Memorandum of Understanding), LoI (Letter of Intent), PKS (Cooperation Agreement)

Recent conversation:
${historyText}
Latest message: ${message}

Answer EXACTLY with one word: MoU, LoI, or PKS. If unclear, choose MoU.`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().toUpperCase();
  if (raw.includes("LOI")) return "LoI";
  if (raw.includes("PKS")) return "PKS";
  return "MoU";
}

// Step 2: Extract structured fields

async function extractFields(
  message: string,
  history: ConversationTurn[],
  documentType: DocumentType,
): Promise<ExtractedFields> {
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });
  const historyText = history
    .map((h) => `${h.role === "user" ? "Pengguna" : "CLARA"}: ${h.content}`)
    .join("\n");

  const prompt = `Extract the following information from this conversation to create a ${documentType}.
Return ONLY a JSON object without any additional explanation.

Required fields:
- party_a_name: name of the first party (company/individual)
- party_a_details: details of the first party (full address, ID/NIB, title, or representative)
- party_b_name: name of the second party (company/partner/individual)
- party_b_details: details of the second party (full address, ID/NIB, title, or representative)
- scope: scope of work / specific obligations of each party
- duration: duration (e.g., "1 year", "12 months", "until completion")
- value: agreement value/price (if any)
- payment_terms: payment mechanism/method (installments, full payment, transfer, etc.)
- penalty: penalty or late fee provisions (if any)
- jurisdiction: domicile city of the court for dispute resolution

Conversation:
${historyText}
Latest message: ${message}

Return JSON. Use null for unknown fields.`;

  const result = await model.generateContent(prompt);
  const raw = result.response
    .text()
    .trim()
    .replace(/```json|```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(raw) as Record<string, string | null>;
    const fields: ExtractedFields = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && v !== "null") fields[k] = v;
    }
    return fields;
  } catch {
    return {};
  }
}

// Step 3: Confidence - based completeness assessment

function assessCompleteness(
  fields: ExtractedFields,
  documentType: DocumentType,
): { score: number; missingCritical: string[] } {
  const criticalFields = [
    "party_a_name",
    "party_a_details",
    "party_b_name",
    "party_b_details",
    "scope",
    "duration"
  ];
  const optionalFields =
    documentType === "PKS"
      ? ["value", "payment_terms", "penalty", "jurisdiction"]
      : ["value", "jurisdiction"];

  const missingCritical = criticalFields.filter((f) => !fields[f]);
  const presentOptional = optionalFields.filter((f) => !!fields[f]).length;

  const criticalScore =
    (criticalFields.length - missingCritical.length) / criticalFields.length;
  const optionalScore =
    optionalFields.length > 0 ? (presentOptional / optionalFields.length) * 0.2 : 0.2;

  return {
    score: Math.min(1, criticalScore * 0.8 + optionalScore),
    missingCritical,
  };
}

// Step 3a: Detect user evasion

/**
 * Returns true if:
 *  1. The most recent assistant turn in history asked about the same field that
 *     is still missing (meaning the user hasn't answered it yet).
 *  2. The most recent user turn did not provide the information.
 *
 * Detection heuristic: look for the field label keyword in the last assistant
 * message, and check that the user's reply is short / vague (< 15 words and
 * doesn't contain a noun phrase for the label).
 */
function detectEvasion(history: ConversationTurn[], missingCritical: string[]): boolean {
  if (!missingCritical.length || history.length < 2) return false;

  const fieldLabels: Record<string, string[]> = {
    party_a_name: ["first party", "name", "company", "individual", "who"],
    party_a_details: ["address", "title", "id", "first party details", "identity"],
    party_b_name: ["second party", "name", "partner", "who"],
    party_b_details: ["address", "title", "id", "second party details", "identity"],
    scope: ["scope", "purpose", "cooperation", "obligations", "tasks"],
    duration: ["duration", "how long", "month", "year", "finish"],
    value: ["value", "price", "how much", "cost"],
    payment_terms: ["payment", "installments", "transfer", "pay"],
    jurisdiction: ["city", "court", "jurisdiction", "dispute", "domicile"],
    penalty: ["penalty", "fine", "sanction", "late"],
  };

  const topField = missingCritical[0];
  const keywords = fieldLabels[topField] ?? [topField];

  // Find the last assistant turn
  const lastAssistant = [...history].reverse().find((h) => h.role === "assistant");
  if (!lastAssistant) return false;

  // Check if last assistant turn mentioned the missing field
  const assistantAsked = keywords.some((kw) =>
    lastAssistant.content.toLowerCase().includes(kw),
  );
  if (!assistantAsked) return false;

  // Check if the most recent user turn answered the field (simple: long enough AND contains keyword)
  const lastUser = [...history].reverse().find((h) => h.role === "user");
  if (!lastUser) return false;

  const wordCount = lastUser.content.trim().split(/\s+/).length;
  const containsKeyword = keywords.some((kw) =>
    lastUser.content.toLowerCase().includes(kw),
  );

  // Evasion: short user reply that doesn't contain the requested field keyword
  return wordCount < 15 && !containsKeyword;
}

// Step 4: Generate a single proactive question

async function generateProactiveQuestion(
  _fields: ExtractedFields,
  history: ConversationTurn[],
  documentType: DocumentType,
  missingCritical: string[],
  isEvasion = false,
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });
  const conversationText = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "Pengguna" : "CLARA"}: ${h.content}`)
    .join("\n");

  const fieldLabels: Record<string, string> = {
    party_a_name: "name of the First Party",
    party_a_details: "full address and identity (ID/Title) of the First Party",
    party_b_name: "name of the Second Party",
    party_b_details: "full address and identity (ID/Title) of the Second Party",
    scope: "detailed scope of work and obligations of each party",
    duration: "validity period of the agreement",
    value: "agreement value or price",
    payment_terms: "payment mechanism or method",
    jurisdiction: "legal domicile city for dispute resolution",
    penalty: "provisions for fines or late penalties",
  };

  const topMissing = missingCritical[0];
  const fieldLabel = fieldLabels[topMissing] ?? topMissing;

  const evasionInstruction = isEvasion
    ? `The user seems to have not answered the previous question about "${fieldLabel}".
Ask again politely but be more specific. Provide an example of the expected information.
DO NOT move on to another point before this is answered.`
    : `Ask an interactive, natural, and empathetic question like a relaxed but professional legal consultant.
Do not act like an interrogating robot. If asking for identity details, you can ask for both name and address together, or guide them to mention standard contract items. You may ask 1-2 highly related things together as long as it's concise. Give brief positive feedback/praise for previous information if relevant.`;

  const prompt = `You are CLARA, an AI legal assistant for MSMEs.
You are helping the user draft a ${documentType}.

Conversation so far:
${conversationText}

Important information that is CURRENTLY INCOMPLETE: ${missingCritical.map((f) => fieldLabels[f] ?? f).join(", ")}.
The main focus to ask right now is: ${fieldLabel}.

${evasionInstruction}

Use clear, warm, English language, and insert emojis occasionally so it doesn't feel stiff. Answer as if in a direct dialogue.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    if (isEvasion) {
      return `I'm sorry, before I continue, I still need to know the ${fieldLabel}. Could you please answer?`;
    }
    return `Could you please tell me the ${fieldLabel}?`;
  }
}

// Step 4a: Persist DrafterSession in Neo4j

async function persistDrafterSession(
  sessionId: string,
  userId: string,
  fields: ExtractedFields,
  documentType: DocumentType,
): Promise<void> {
  const session = await getSession();
  try {
    await session.run(
      `
      MERGE (ds:DrafterSession { id: $sessionId })
      SET ds.user_id       = $userId,
          ds.document_type = $documentType,
          ds.fields        = $fields,
          ds.updated_at    = datetime()
      `,
      {
        sessionId,
        userId,
        documentType,
        fields: JSON.stringify(fields),
      },
    );
  } catch {
    // Persistence is best-effort – don't block the user
  } finally {
    await session.close();
  }
}

// Step 5: Fetch clause templates from Neo4j

interface ClauseTemplate {
  id: string;
  title: string;
  order: number;
  template: string;
}

async function fetchClauseTemplates(
  documentType: DocumentType,
): Promise<ClauseTemplate[]> {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (t:ClauseTemplate)
      WHERE t.document_type = $docType
      RETURN t.id AS id, t.title AS title, t.order AS order, t.template AS template
      ORDER BY t.order ASC
      `,
      { docType: documentType },
    );
    return result.records.map((rec) => ({
      id: rec.get("id") as string,
      title: rec.get("title") as string,
      order: (rec.get("order") as number) ?? 0,
      template: rec.get("template") as string,
    }));
  } finally {
    await session.close();
  }
}

// Default clause templates if Neo4j is empty
const DEFAULT_TEMPLATES: Record<DocumentType, ClauseTemplate[]> = {
  MoU: [
    {
      id: "default-1",
      title: "THE PARTIES",
      order: 1,
      template:
        "This agreement is made between **{{party_a_name}}** and **{{party_b_name}}**.",
    },
    {
      id: "default-2",
      title: "SCOPE",
      order: 2,
      template: "Scope of cooperation: {{scope}}",
    },
    {
      id: "default-3",
      title: "DURATION",
      order: 3,
      template: "This agreement is valid for {{duration}} from the date of signing.",
    },
    {
      id: "default-4",
      title: "CONFIDENTIALITY",
      order: 4,
      template:
        "The Parties shall keep confidential any information obtained during the cooperation.",
    },
    {
      id: "default-5",
      title: "DISPUTE RESOLUTION",
      order: 5,
      template:
        "Disputes shall be resolved through amicable settlement, and if it fails, through the {{jurisdiction}} District Court.",
    },
  ],
  LoI: [
    {
      id: "default-1",
      title: "STATEMENT OF INTENT",
      order: 1,
      template:
        "**{{party_a_name}}** expresses the intent to cooperate with **{{party_b_name}}** in the field of {{scope}}.",
    },
    {
      id: "default-2",
      title: "NEGOTIATION PERIOD",
      order: 2,
      template: "Further negotiations will be conducted within a period of {{duration}}.",
    },
  ],
  PKS: [
    {
      id: "default-1",
      title: "THE PARTIES",
      order: 1,
      template:
        "This Cooperation Agreement is made between **{{party_a_name}}** (First Party) and **{{party_b_name}}** (Second Party).",
    },
    {
      id: "default-2",
      title: "SCOPE",
      order: 2,
      template: "Scope of cooperation: {{scope}}",
    },
    {
      id: "default-3",
      title: "DURATION",
      order: 3,
      template: "This Cooperation Agreement is valid for {{duration}}.",
    },
    {
      id: "default-4",
      title: "PAYMENT",
      order: 4,
      template: "Cooperation value: {{value}}. Penalty provisions: {{penalty}}.",
    },
    {
      id: "default-5",
      title: "DISPUTE RESOLUTION",
      order: 5,
      template: "Disputes shall be resolved through the {{jurisdiction}} District Court.",
    },
  ],
};

// Step 5: Assemble document

function fillTemplate(template: string, fields: ExtractedFields): string {
  let filled = template;
  for (const [key, value] of Object.entries(fields)) {
    filled = filled.replace(
      new RegExp(`{{${key}}}`, "g"),
      value ?? `[${key.toUpperCase()}]`,
    );
  }
  // Replace any remaining unfilled placeholders
  filled = filled.replace(/{{[^}]+}}/g, "[NOT FILLED YET]");
  return filled;
}

function assembleDraft(
  documentType: DocumentType,
  fields: ExtractedFields,
  templates: ClauseTemplate[],
  documentNumber: string,
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const typeLabels: Record<DocumentType, string> = {
    MoU: "MEMORANDUM OF UNDERSTANDING",
    LoI: "LETTER OF INTENT",
    PKS: "COOPERATION AGREEMENT",
  };

  let doc = `# ${typeLabels[documentType]}\n`;
  doc += `**Number: ${documentNumber}**\n\n`;
  doc += `---\n\n`;
  doc += `This **${typeLabels[documentType]}** (hereinafter referred to as the "Agreement") is executed in Jakarta, on **${dateStr}**, by and between:\n\n`;

  doc += `**1. ${fields.party_a_name ?? "[Name of First Party]"}**\n\n`;
  doc += `${fields.party_a_details ?? "[Details/Address of First Party]"}\n\n`;
  doc += `(hereinafter referred to as the **"FIRST PARTY"**).\n\n`;

  doc += `**2. ${fields.party_b_name ?? "[Name of Second Party]"}**\n\n`;
  doc += `${fields.party_b_details ?? "[Details/Address of Second Party]"}\n\n`;
  doc += `(hereinafter referred to as the **"SECOND PARTY"**).\n\n`;

  doc += `The FIRST PARTY and the SECOND PARTY (collectively referred to as the "Parties") mutually agree to the following terms and conditions:\n\n`;
  doc += `---\n\n`;

  for (const tmpl of templates) {
    doc += `## ${tmpl.title}\n\n`;
    doc += fillTemplate(tmpl.template, fields);
    doc += "\n\n";
  }

  doc += `---\n\n`;
  doc += `*IN WITNESS WHEREOF, this Agreement is executed consciously and without coercion from any party on the date first above written.*\n\n`;

  // GFM Markdown Table for Signatures
  doc += `| **FIRST PARTY** | **SECOND PARTY** |\n`;
  doc += `| :---: | :---: |\n`;
  doc += `| <br><br><br><br> | <br><br><br><br> |\n`;
  doc += `| __________________________ | __________________________ |\n`;
  doc += `| **${fields.party_a_name ?? "[Name of First Party]"}** | **${fields.party_b_name ?? "[Name of Second Party]"}** |\n`;

  return doc;
}

// Main export

export async function runDrafterTurn(req: DrafterRequest): Promise<DrafterResponse> {
  const userId = req.userId ?? "anonymous";

  // 1. Fetch persistent history
  const { getSessionHistory, saveChatMessage } = await import("../chat/chatService");
  const { history: storedHistory } = await getSessionHistory(req.session_id);

  // Format history for classification and extraction (which expect "user" | "assistant")
  const historyForFunctions = storedHistory.map(h => ({
    role: (h.role === "model" || h.role === "assistant") ? "assistant" as const : "user" as const,
    content: h.content,
  }));

  // Format history for Gemini (which expects "user" | "model")
  const historyForGemini = storedHistory.map(h => ({
    role: (h.role === "assistant" || h.role === "model") ? "model" as const : "user" as const,
    content: h.content,
  }));

  const fullHistory = [...historyForGemini, { role: "user" as const, content: req.message }];

  // 1b. Save the user's incoming message immediately
  await saveChatMessage(req.session_id, userId, "drafter", "user", req.message);

  // 2. Classify intent
  const documentType = await classifyIntent(req.message, historyForGemini);

  // ... [Binding warning logic] ...
  const allUserText = fullHistory
    .filter((h) => h.role === "user")
    .map((h) => h.content)
    .join(" ");
  const binding_warning = documentType === "MoU" && hasBindingTerms(allUserText);

  // 3. Extract fields
  const fields = await extractFields(req.message, historyForFunctions, documentType);

  // 4. Confidence gate (Module 5)
  const { score, missingCritical } = assessCompleteness(fields, documentType);
  const MIN_CONFIDENCE = env.DRAFTER_MIN_CONFIDENCE;

  if (score < MIN_CONFIDENCE) {
    await persistDrafterSession(req.session_id, userId, fields, documentType).catch(
      () => { },
    );
    const isEvasion = detectEvasion(historyForFunctions, missingCritical);
    const question = await generateProactiveQuestion(
      fields,
      historyForFunctions,
      documentType,
      missingCritical,
      isEvasion,
    );

    // Save AI question to history
    await saveChatMessage(req.session_id, userId, "drafter", "model", question);

    return {
      status: "needs_clarification",
      document_type: documentType,
      binding_warning,
      clarifying_questions: [question],
    };
  }

  // 5. Fetch clause templates
  let templates: ClauseTemplate[] = [];
  try {
    templates = await fetchClauseTemplates(documentType);
  } catch {
    // Neo4j unavailable — use defaults
  }
  if (templates.length === 0) {
    templates = DEFAULT_TEMPLATES[documentType];
  }

  // 6. Assemble draft
  const documentNumber = generateDocumentNumber(documentType);
  const draft = assembleDraft(documentType, fields, templates, documentNumber);

  // 6a. Generate PDF (best-effort — never blocks draft delivery)
  let pdf_base64: string | undefined;
  try {
    pdf_base64 = generateDraftPdf(draft);
  } catch (pdfErr) {
    console.warn("[drafter] PDF generation failed (non-fatal):", pdfErr);
  }

  // Module 6 – Guardrail on draft
  let guardrailResult: DrafterResponse["guardrail"] | undefined;
  try {
    const { runGuardrailChecks } = await import("../guardrail/guardrailService");
    const gr = await runGuardrailChecks(draft);
    guardrailResult = {
      is_safe: gr.is_safe,
      warning_count: gr.warning_count,
      critical_violations: gr.critical_violations,
    };
  } catch {
    // Guardrail failure doesn't block draft delivery
  }

  await persistDrafterSession(req.session_id, userId, fields, documentType).catch(
    () => { },
  );

  return {
    status: "draft_ready",
    document_type: documentType,
    binding_warning,
    draft,
    document_number: documentNumber,
    pdf_base64,
    action_buttons: pdf_base64 ? ["Accept", "Revise"] : undefined,
    guardrail: guardrailResult,
  };
}
