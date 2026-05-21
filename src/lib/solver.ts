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
  const pattern: number[] = [0, 0, 0, 0, 0];
  const remaining: (string | null)[] = [...answer];

  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      pattern[i] = 2;
      remaining[i] = null;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (pattern[i] === 2) continue;
    for (let j = 0; j < 5; j++) {
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
