/**
 * Utility functions for normalizing answers (Chemical formulas, numbers, strings)
 * and verifying student submissions regardless of uppercase/lowercase, spaces, 
 * subscripts (₂, ₃, ₄), superscripts (², ³, ⁴), etc.
 */

export function normalizeFormulaOrNumber(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  let s = String(input).trim();

  // 1. Map Unicode Subscripts to regular characters
  const subscriptMap: Record<string, string> = {
    '₀': '0',
    '₁': '1',
    '₂': '2',
    '₃': '3',
    '₄': '4',
    '₅': '5',
    '₆': '6',
    '₇': '7',
    '₈': '8',
    '₉': '9',
    '₊': '+',
    '₋': '-',
  };

  // 2. Map Unicode Superscripts to regular characters
  const superscriptMap: Record<string, string> = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
    '⁺': '+',
    '⁻': '-',
  };

  for (const [sub, char] of Object.entries(subscriptMap)) {
    s = s.split(sub).join(char);
  }

  for (const [sup, char] of Object.entries(superscriptMap)) {
    s = s.split(sup).join(char);
  }

  // 3. Remove spaces, dashes, commas, dots
  s = s.replace(/[\s\-_.,;:]/g, '');

  // 4. Convert to lowercase for case insensitivity
  s = s.toLowerCase();

  return s;
}

export function checkShortAnswer(
  userAnswer: string | number | undefined | null,
  correctAnswer: string | number | undefined | null,
  acceptableAnswers?: string[]
): boolean {
  const normUser = normalizeFormulaOrNumber(userAnswer);
  if (!normUser) return false;

  const normCorrect = normalizeFormulaOrNumber(correctAnswer);
  if (normUser === normCorrect) return true;

  if (acceptableAnswers && Array.isArray(acceptableAnswers)) {
    for (const alt of acceptableAnswers) {
      if (normalizeFormulaOrNumber(alt) === normUser) {
        return true;
      }
    }
  }

  // Common Vietnamese prefixes for years / values (e.g. "năm 1954" vs "1954")
  const stripPrefix = (val: string | number | undefined | null) => {
    return String(val || '')
      .replace(/^(năm|nam|số|so)\s*/i, '')
      .trim()
      .toLowerCase()
      .replace(/[\s\-_.,;:]/g, '');
  };

  if (stripPrefix(userAnswer) === stripPrefix(correctAnswer)) return true;

  if (acceptableAnswers && Array.isArray(acceptableAnswers)) {
    for (const alt of acceptableAnswers) {
      if (stripPrefix(alt) === stripPrefix(userAnswer)) {
        return true;
      }
    }
  }

  return false;
}
