// Mocks must be declared before importing the module under test.
jest.mock("@google/generative-ai", () => {
  const generateContent = jest.fn().mockResolvedValue({
    response: { text: () => "PASAL 1\nIsi dari gemini." },
  });
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({ generateContent }),
    })),
  };
});

jest.mock("../../config/env", () => ({
  env: { GOOGLE_AI_API_KEY: "test-key", GEMINI_MODEL: "gemini-test" },
}));

// Controllable pdf-parse mock: tests set __pdfText / __pdfTotal before calling.
const pdfState: { text: string; total: number } = { text: "", total: 0 };
jest.mock("pdf-parse", () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({
      get text() {
        return pdfState.text;
      },
      get total() {
        return pdfState.total;
      },
    }),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { extractTextFromPdf } from "./ocrService";

describe("extractTextFromPdf — OCR facts", () => {
  it("reports pdf-parse method + page count when text is extracted locally", async () => {
    pdfState.text = "PASAL 1\nIsi kontrak yang panjang.";
    pdfState.total = 5;
    const r = await extractTextFromPdf(Buffer.from("x"));
    expect(r.method).toBe("pdf-parse");
    expect(r.pageCount).toBe(5);
    expect(r.text).toContain("PASAL 1");
  });

  it("falls back to gemini with null page count when local text is empty", async () => {
    pdfState.text = "";
    pdfState.total = 0;
    const r = await extractTextFromPdf(Buffer.from("x"));
    expect(r.method).toBe("gemini");
    expect(r.pageCount).toBeNull();
    expect(r.text).toContain("gemini");
  });
});
