"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadWords,
  filterPossible,
  bestGuess,
  decomposeWord,
  type WordEntry,
} from "@/lib/solver";

const TOTAL_WORDS = 3786;

type Attempt = {
  jamo: string[];
  word: string;
  pattern: number[];
};

type GameStatus = "playing" | "won" | "lost";

function tileColorClass(val: number) {
  if (val === 2) return "bg-emerald-500 text-white";
  if (val === 1) return "bg-yellow-400 text-black";
  return "bg-slate-400 text-white";
}

function JamoTile({
  char,
  value,
  selected,
  onClick,
}: {
  char: string;
  value: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-14 h-14 flex items-center justify-center text-xl font-bold rounded select-none
        ${tileColorClass(value)}
        ${onClick ? "cursor-pointer hover:opacity-80 active:scale-95 transition-transform" : "cursor-default"}
        ${selected ? "ring-3 ring-offset-2 ring-zinc-900 dark:ring-white" : ""}
      `}
    >
      {char}
    </button>
  );
}

function resetState() {
  return {
    attempts: [] as Attempt[],
    suggestion: { jamo: [] as string[], word: "" },
    pattern: [] as number[],
    length: null as number | null,
    remaining: 0,
    candidates: null as string[] | null,
    status: "playing" as GameStatus,
    error: null as string | null,
  };
}

export default function Home() {
  const [allWords, setAllWords] = useState<WordEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputWord, setInputWord] = useState("");
  const [banned, setBanned] = useState<Set<string>>(new Set());
  const [state, setState] = useState(resetState);
  const [lengthCounts, setLengthCounts] = useState<[number, number][] | null>(null);

  useEffect(() => {
    loadWords().then((words) => {
      setAllWords(words);
      const counts = new Map<number, number>();
      for (const [jamo] of words) {
        counts.set(jamo.length, (counts.get(jamo.length) ?? 0) + 1);
      }
      setLengthCounts([...counts.entries()].sort((a, b) => a[0] - b[0]));
    });
  }, []);

  const {
    attempts,
    suggestion,
    pattern,
    length,
    remaining,
    candidates,
    status,
    error,
  } = state;
  const attemptNum = attempts.length + 1;
  const inputJamo = inputWord.trim() ? decomposeWord(inputWord.trim()) : suggestion.jamo;
  const displayWord = inputWord.trim() || suggestion.word;
  const displayJamo = inputWord.trim() ? inputJamo : suggestion.jamo;

  function cyclePattern(i: number) {
    setState((prev) => {
      const next = [...prev.pattern];
      next[i] = (next[i] + 1) % 3;
      return { ...prev, pattern: next };
    });
  }

  function selectLength(len: number) {
    if (!allWords) return;
    const filtered = allWords.filter(([j]) => j.length === len);
    const notBanned = filtered.filter(([, w]) => !banned.has(w));
    if (notBanned.length === 0) return;
    const [bj, bw] = bestGuess(notBanned, filtered);
    setState((prev) => ({
      ...prev,
      suggestion: { jamo: bj, word: bw },
      pattern: Array(len).fill(0),
      length: len,
      remaining: filtered.length,
      candidates: filtered.length <= 6 ? filtered.map(([, w]) => w) : null,
      error: null,
    }));
    setSelectedIndex(0);
  }

  function banWord(word: string) {
    const next = new Set(banned);
    if (next.has(word)) next.delete(word);
    else next.add(word);
    setBanned(next);
  }

  // recompute hint when banned words change
  useEffect(() => {
    if (!allWords || !length) return;
    if (status !== "playing") return;
    const possibleByLen = allWords.filter(([j]) => j.length === length);
    let possible = possibleByLen;
    for (const { jamo, pattern: p } of attempts) {
      possible = filterPossible(possible, jamo, p);
    }
    if (possible.length === 0) return;
    const searchPool = possibleByLen.filter(([, w]) => !banned.has(w));
    if (searchPool.length === 0) return;
    const [bj, bw] = bestGuess(searchPool, possible);
    setState((prev) => ({
      ...prev,
      suggestion: { jamo: bj, word: bw },
    }));
  }, [banned, length, allWords, attempts, status]);

  const handleSubmit = useCallback(async () => {
    if (!allWords || !length) return;
    if (displayJamo.length !== length) {
      setState((prev) => ({ ...prev, error: `자소 길이가 ${length}자가 아닙니다 (입력: ${displayJamo.length}자)` }));
      return;
    }

    const currentAttempt: Attempt = {
      jamo: displayJamo,
      word: displayWord,
      pattern,
    };

    if (pattern.every((v) => v === 2)) {
      setState((prev) => ({
        ...prev,
        attempts: [...prev.attempts, currentAttempt],
        status: "won",
      }));
      return;
    }

    if (attempts.length + 1 >= 6) {
      setState((prev) => ({
        ...prev,
        attempts: [...prev.attempts, currentAttempt],
        status: "lost",
      }));
      return;
    }

    setLoading(true);
    setState((prev) => ({ ...prev, error: null }));

    const newHistory = [...attempts, currentAttempt];

    // yield to React so "계산 중..." renders before computation blocks
    await new Promise((resolve) => setTimeout(resolve, 0));

    const possibleByLen = allWords.filter(([j]) => j.length === length);
    const searchPool = possibleByLen.filter(([, w]) => !banned.has(w));
    let possible = possibleByLen;
    for (const { jamo, pattern: p } of newHistory) {
      possible = filterPossible(possible, jamo, p);
    }

    if (possible.length === 0) {
      setState((prev) => ({ ...prev, error: "조건에 맞는 단어가 없습니다" }));
      setLoading(false);
      return;
    }

    const [nextJamo, nextWord] = bestGuess(searchPool.length > 0 ? searchPool : possibleByLen, possible);
    const candidates = possible.length <= 6 ? possible.map(([, w]) => w) : null;

    setState((prev) => ({
      ...prev,
      attempts: newHistory,
      suggestion: { jamo: nextJamo, word: nextWord },
      remaining: possible.length,
      candidates,
      pattern: Array(length).fill(0),
    }));
    setInputWord("");
    setSelectedIndex(0);
    setLoading(false);
  }, [allWords, suggestion, pattern, attempts, length, displayJamo, displayWord, banned]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (status !== "playing") {
        if (e.key === "Enter" && (status === "won" || status === "lost")) {
          setState(resetState());
          setSelectedIndex(0);
        }
        return;
      }
      const n = suggestion.jamo.length;
      if (n === 0) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((i) => (i + n - 1) % n);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % n);
      } else if (e.key === " ") {
        e.preventDefault();
        cyclePattern(selectedIndex);
      } else if (e.key === "Enter" && !loading && allWords && length && status === "playing") {
        handleSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    status,
    loading,
    allWords,
    attempts,
    suggestion,
    pattern,
    selectedIndex,
    handleSubmit,
    length,
    inputWord,
  ]);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center py-12 px-4">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          카카오톡 단어 맞추기
        </h1>
        <a
          href="https://github.com/psvm203/kakaotalk-wordle-solver"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          aria-label="GitHub 저장소"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </a>
      </div>

      {!length ? (
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-lg text-zinc-700 dark:text-zinc-300">
            자소 길이를 선택하세요
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            {(lengthCounts ?? []).map(([len, cnt]) => (
              <button
                key={len}
                onClick={() => selectLength(len)}
                className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-lg transition-colors"
              >
                {len}자소 ({cnt.toLocaleString()}개)
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setState(resetState())}
              className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline"
            >
              길이 변경
            </button>
            <span className="text-xs text-zinc-400">
              {length}자소 · {TOTAL_WORDS.toLocaleString()}개 단어
            </span>
          </div>

          {attempts.length > 0 && (
            <div className="flex flex-col gap-2 mb-6">
              {attempts.map((a, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm text-zinc-400 w-4">{idx + 1}</span>
                  <div className="flex gap-1">
                    {a.jamo.map((j, i) => (
                      <JamoTile key={i} char={j} value={a.pattern[i]} />
                    ))}
                  </div>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {a.word}
                  </span>
                </div>
              ))}
            </div>
          )}

          {status === "playing" && (
            <div className="flex flex-col items-center gap-4">
              <div className="text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-1">
                  시도 {attemptNum}/6 · 남은 후보 {remaining.toLocaleString()}개
                </p>
                <div className="flex items-center justify-center gap-3">
                  <p className="text-4xl font-bold text-zinc-900 dark:text-white tracking-wide">
                    {suggestion.word}
                  </p>
                  <button
                    onClick={() => banWord(suggestion.word)}
                    className={`px-2 py-1 text-xs font-semibold rounded-full transition-colors ${
                      banned.has(suggestion.word)
                        ? "bg-red-500 text-white"
                        : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 hover:bg-red-200 dark:hover:bg-red-800"
                    }`}
                    title={banned.has(suggestion.word) ? "밴 해제" : "이 단어 밴"}
                  >
                    {banned.has(suggestion.word) ? "밴됨" : "밴"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputWord}
                  onChange={(e) => setInputWord(e.target.value)}
                  placeholder={suggestion.word}
                  className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white w-32"
                />
                <span className="text-xs text-zinc-400">
                  (빈칸=힌트 단어)
                </span>
              </div>

              <div className="flex gap-2">
                {displayJamo.map((j, i) => (
                  <JamoTile
                    key={i}
                    char={j}
                    value={pattern[i] ?? 0}
                    selected={i === selectedIndex}
                    onClick={() => {
                      setSelectedIndex(i);
                      cyclePattern(i);
                    }}
                  />
                ))}
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                클릭하거나 좌우 방향키로 이동 후 Space를 눌러 상태를 변경하세요
              </p>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={loading || !allWords}
                className="mt-1 px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold rounded-full disabled:opacity-50 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                {loading
                  ? "계산 중..."
                  : !allWords
                    ? "로딩 중..."
                    : "결과 제출 (Enter)"}
              </button>

              {candidates && (
                <div className="mt-2 text-center">
                  <p className="text-xs text-zinc-400 mb-1">남은 후보</p>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {candidates.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {status === "won" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-3xl font-bold text-emerald-500">정답!</p>
              <p className="text-zinc-500 dark:text-zinc-400">
                {attempts.length}번만에 성공했습니다
              </p>
              <button
                onClick={() => setState(resetState())}
                className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold rounded-full hover:bg-zinc-700 transition-colors"
              >
                다시 시작 (Enter)
              </button>
            </div>
          )}

          {status === "lost" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-3xl font-bold text-red-500">실패</p>
              <p className="text-zinc-500 dark:text-zinc-400">
                6번 안에 맞추지 못했습니다
              </p>
              <button
                onClick={() => setState(resetState())}
                className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold rounded-full hover:bg-zinc-700 transition-colors"
              >
                다시 시작
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
