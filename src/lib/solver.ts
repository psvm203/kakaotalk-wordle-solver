export type Jamo = string[];
export type Pattern = number[];
export type WordEntry = [Jamo, string];

export async function loadWords(): Promise<WordEntry[]> {
  const res = await fetch("/words.txt");
  const text = await res.text();
  const words: WordEntry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const jamo = parts[0].split("") as Jamo;
    const word = parts.length > 1 ? parts[1] : parts[0];
    words.push([jamo, word]);
  }
  return words;
}

export function getPattern(guess: Jamo, answer: Jamo): Pattern {
  const n = guess.length;
  const pattern: number[] = Array(n).fill(0);
  const remaining: (string | null)[] = [...answer];

  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      pattern[i] = 2;
      remaining[i] = null;
    }
  }

  for (let i = 0; i < n; i++) {
    if (pattern[i] === 2) continue;
    for (let j = 0; j < n; j++) {
      if (remaining[j] !== null && remaining[j] === guess[i]) {
        pattern[i] = 1;
        remaining[j] = null;
        break;
      }
    }
  }

  return pattern;
}

export function calcEntropy(guessJamo: Jamo, possible: WordEntry[]): number {
  if (possible.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const [ansJamo] of possible) {
    const key = getPattern(guessJamo, ansJamo).join("");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = possible.length;
  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function bestGuess(
  allWords: WordEntry[],
  possible: WordEntry[],
): WordEntry {
  if (possible.length === 1) return possible[0];

  const possibleSet = new Set(possible.map(([j]) => j.join("")));
  let best: WordEntry | null = null;
  let bestScore = -1;

  for (const [jamo, word] of allWords) {
    let score = calcEntropy(jamo, possible);
    if (possibleSet.has(jamo.join(""))) score += 1e-6;
    if (score > bestScore) {
      bestScore = score;
      best = [jamo, word];
    }
  }

  return best!;
}

const chosung = [
  "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ",
  "ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ",
];
const jungsung = [
  "ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ",
  "ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ",
  "ㅠ","ㅡ","ㅢ","ㅣ",
];
const jongsung = [
  "","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ",
  "ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ",
  "ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ",
  "ㅋ","ㅌ","ㅍ","ㅎ",
];

const doubleInitial: Record<string, string> = { "ㄲ": "ㄱㄱ", "ㄸ": "ㄷㄷ", "ㅃ": "ㅂㅂ", "ㅆ": "ㅅㅅ", "ㅉ": "ㅈㅈ" };
const compoundVowel: Record<string, string> = {
  "ㅐ": "ㅏㅣ", "ㅒ": "ㅑㅣ", "ㅔ": "ㅓㅣ", "ㅖ": "ㅕㅣ",
  "ㅘ": "ㅗㅏ", "ㅙ": "ㅗㅏㅣ", "ㅚ": "ㅗㅣ",
  "ㅝ": "ㅜㅓ", "ㅞ": "ㅜㅓㅣ", "ㅟ": "ㅜㅣ", "ㅢ": "ㅡㅣ",
};
const doubleFinal: Record<string, string> = {
  "ㄲ": "ㄱㄱ", "ㄳ": "ㄱㅅ", "ㄵ": "ㄴㅈ", "ㄶ": "ㄴㅎ",
  "ㄺ": "ㄹㄱ", "ㄻ": "ㄹㅁ", "ㄼ": "ㄹㅂ", "ㄽ": "ㄹㅅ",
  "ㄾ": "ㄹㅌ", "ㄿ": "ㄹㅍ", "ㅀ": "ㄹㅎ",
  "ㅄ": "ㅂㅅ", "ㅆ": "ㅅㅅ",
};

export function decomposeWord(word: string): string[] {
  const result: string[] = [];
  for (const c of word) {
    const code = c.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) {
      result.push(c);
      continue;
    }
    const cho = (code / 588) | 0;
    const jung = ((code % 588) / 28) | 0;
    const jong = code % 28;
    const choJamo = doubleInitial[chosung[cho]] ?? chosung[cho];
    const jungJamo = compoundVowel[jungsung[jung]] ?? jungsung[jung];
    result.push(...choJamo.split(""), ...jungJamo.split(""));
    if (jong > 0) {
      const jongJamo = doubleFinal[jongsung[jong]] ?? jongsung[jong];
      result.push(...jongJamo.split(""));
    }
  }
  return result;
}

export function filterPossible(
  possible: WordEntry[],
  guessJamo: Jamo,
  pattern: Pattern,
): WordEntry[] {
  const patternKey = pattern.join("");
  return possible.filter(
    ([ansJamo]) => getPattern(guessJamo, ansJamo).join("") === patternKey,
  );
}
