export type QuestionKind =
  | "structural_count"
  | "structural_fetch"
  | "structural_list"
  | "reasoning";

export interface RoutedQuestion {
  kind: QuestionKind;
  pasalNumber?: number;
  ayatNumber?: number;
}

const LAW_REF =
  /\b(uu|undang-undang|kuhper(data)?|kuhp|kitab|pp|permenaker|peraturan\s+pemerintah)\b/i;
const COUNT = /\b(berapa|jumlah|banyak)\b/i;
const LIST = /\b(sebutkan|daftar|seluruh|semua|apa\s+saja|list)\b/i;
const PASAL_NUM = /pasal\s+(\d+)/i;
const AYAT_NUM = /ayat\s+\(?(\d+)\)?/i;
const PASAL_WORD = /\bpasal\b/i;

export function classifyQuestion(question: string, hasDocument: boolean): RoutedQuestion {
  if (!hasDocument) return { kind: "reasoning" };

  // A statute reference means this is a legal-reasoning question about the law,
  // not a "fetch clause N from my document" question.
  if (LAW_REF.test(question)) return { kind: "reasoning" };

  const pasalMatch = question.match(PASAL_NUM);

  if (COUNT.test(question) && PASAL_WORD.test(question))
    return { kind: "structural_count" };
  if (LIST.test(question) && PASAL_WORD.test(question) && !pasalMatch)
    return { kind: "structural_list" };

  if (pasalMatch) {
    const ayatMatch = question.match(AYAT_NUM);
    return {
      kind: "structural_fetch",
      pasalNumber: parseInt(pasalMatch[1], 10),
      ayatNumber: ayatMatch ? parseInt(ayatMatch[1], 10) : undefined,
    };
  }
  return { kind: "reasoning" };
}
