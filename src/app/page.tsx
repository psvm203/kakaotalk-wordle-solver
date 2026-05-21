"use client";

import { useState, useEffect } from "react";
import {
  loadWords,
  filterPossible,
  bestGuess,
  type WordEntry,
} from "@/lib/solver";

const FIRST_GUESS = {
  jamo: ["ㄱ", "ㅏ", "ㅇ", "ㅜ", "ㅣ"],
  word: "가위",
};

const TOTAL_WORDS = 1103;

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
    suggestion: FIRST_GUESS,
    pattern: [0, 0, 0, 0, 0],
    remaining: TOTAL_WORDS,
    candidates: null as string[] | null,
    status: "playing" as GameStatus,
    error: null as string | null,
  };
}

export default function Home() {
  const [allWords, setAllWords] = useState<WordEntry[] | null>(null);
  const [state, setState] = useState(resetState);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    loadWords().then(setAllWords);
  }, []);

  const {
    attempts,
    suggestion,
    pattern,
    remaining,
    candidates,
    status,
    error,
  } = state;
  const attemptNum = attempts.length + 1;

  function cyclePattern(i: number) {
    setState((prev) => {
      const next = [...prev.pattern];
      next[i] = (next[i] + 1) % 3;
      return { ...prev, pattern: next };
    });
  }

  async function handleSubmit() {
    if (!allWords) return;

    const currentAttempt: Attempt = {
      jamo: suggestion.jamo,
      word: suggestion.word,
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

    if (attemptNum >= 6) {
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

    let possible = allWords;
    for (const { jamo, pattern: p } of newHistory) {
      possible = filterPossible(possible, jamo, p);
    }

    if (possible.length === 0) {
      setState((prev) => ({ ...prev, error: "조건에 맞는 단어가 없습니다" }));
      setLoading(false);
      return;
    }

    const [nextJamo, nextWord] = bestGuess(allWords, possible);
    const candidates = possible.length <= 6 ? possible.map(([, w]) => w) : null;

    setState((prev) => ({
      ...prev,
      attempts: newHistory,
      suggestion: { jamo: nextJamo, word: nextWord },
      remaining: possible.length,
      candidates,
      pattern: [0, 0, 0, 0, 0],
    }));
    setSelectedIndex(0);
    setLoading(false);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (status !== "playing") {
        if (e.key === "Enter" && (status === "won" || status === "lost")) {
          setState(resetState());
          setSelectedIndex(0);
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 4) % 5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % 5);
      } else if (e.key === " ") {
        e.preventDefault();
        cyclePattern(selectedIndex);
      } else if (e.key === "Enter" && !loading && allWords) {
        handleSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, loading, allWords, attempts, suggestion, pattern, selectedIndex]);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center py-12 px-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
        카카오톡 단어 맞추기
      </h1>

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
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">
              시도 {attemptNum}/6 · 남은 후보 {remaining.toLocaleString()}개
            </p>
            <p className="text-4xl font-bold text-zinc-900 dark:text-white tracking-wide">
              {suggestion.word}
            </p>
          </div>

          <div className="flex gap-2">
            {suggestion.jamo.map((j, i) => (
              <JamoTile
                key={i}
                char={j}
                value={pattern[i]}
                selected={i === selectedIndex}
                onClick={() => {
                  setSelectedIndex(i);
                  cyclePattern(i);
                }}
              />
            ))}
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            각 자모를 클릭하거나 Space를 눌러 상태를 변경하세요
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
    </div>
  );
}
