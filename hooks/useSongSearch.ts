"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchApiResponse, SearchSuccess } from "@/lib/api/contract";
import type { Track } from "@/lib/music/types";
import { detectInput, MIN_TEXT_QUERY_LENGTH } from "@/lib/search/detect";

export const SEARCH_DEBOUNCE_MS = 300;
const REQUEST_TIMEOUT_MS = 15_000;
const CLIENT_CACHE_LIMIT = 50;

const NETWORK_ERROR = "We couldn't reach the server. Check your connection and try again.";
const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

export type SearchStatus = "idle" | "loading" | "success" | "error";

export interface SongSearch {
  query: string;
  status: SearchStatus;
  result: SearchSuccess | null;
  /** Problem with what was typed, shown under the field. */
  inputError: string | null;
  /** Problem reported by the lookup itself, shown in the results area. */
  error: string | null;
  loadingMore: boolean;
  loadMoreError: string | null;
  /** True when the current text is worth submitting. */
  canSubmit: boolean;
  setQuery: (value: string) => void;
  /** Shows text in the box without searching, e.g. words still being spoken. */
  showText: (value: string) => void;
  /** Puts text in the box and searches for it straight away. */
  searchFor: (value: string) => void;
  submit: () => void;
  clear: () => void;
  loadMore: () => void;
}

interface State {
  status: SearchStatus;
  result: SearchSuccess | null;
  inputError: string | null;
  error: string | null;
  loadingMore: boolean;
  loadMoreError: string | null;
}

const IDLE: State = {
  status: "idle",
  result: null,
  inputError: null,
  error: null,
  loadingMore: false,
  loadMoreError: null,
};

function isSearchable(value: string): boolean {
  const detected = detectInput(value);
  if (detected.kind === "empty" || detected.kind === "invalid") return false;
  return detected.kind !== "text" || detected.query.length >= MIN_TEXT_QUERY_LENGTH;
}

async function fetchSearch(params: URLSearchParams, signal: AbortSignal): Promise<SearchApiResponse> {
  const response = await fetch(`/api/search?${params}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    headers: { Accept: "application/json" },
  });
  const body = (await response.json()) as SearchApiResponse;
  if (typeof body !== "object" || body === null || typeof body.ok !== "boolean") {
    throw new Error("Malformed response");
  }
  return body;
}

function mergeTracks(current: Track[], incoming: Track[]): Track[] {
  const seen = new Set(current.map((track) => track.id));
  return [...current, ...incoming.filter((track) => !seen.has(track.id))];
}

/**
 * Drives the universal search box: debounced search-as-you-type, immediate
 * submission, cancellation of superseded requests, a small client-side cache
 * so repeated queries cost nothing, and "load more" paging.
 */
export function useSongSearch(): SongSearch {
  const [query, setQueryState] = useState("");
  const [state, setState] = useState<State>(IDLE);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, SearchSuccess>());
  const latestRun = useRef(0);

  const cancelPending = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    controller.current?.abort();
    controller.current = null;
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  const run = useCallback(
    async (value: string) => {
      cancelPending();
      const detected = detectInput(value);

      if (detected.kind === "empty") {
        setState(IDLE);
        return;
      }
      if (detected.kind === "invalid") {
        setState({ ...IDLE, inputError: detected.message });
        return;
      }
      if (detected.kind === "text" && detected.query.length < MIN_TEXT_QUERY_LENGTH) {
        setState({
          ...IDLE,
          inputError: `Type at least ${MIN_TEXT_QUERY_LENGTH} characters to search.`,
        });
        return;
      }

      const key = JSON.stringify(detected).toLowerCase();
      const cached = cache.current.get(key);
      if (cached) {
        setState({ ...IDLE, status: "success", result: cached });
        return;
      }

      const runId = (latestRun.current += 1);
      const abort = new AbortController();
      controller.current = abort;
      setState((previous) => ({ ...IDLE, status: "loading", result: previous.result }));

      try {
        const body = await fetchSearch(new URLSearchParams({ q: value.trim() }), abort.signal);
        if (runId !== latestRun.current) return;
        if (body.ok) {
          if (cache.current.size >= CLIENT_CACHE_LIMIT) {
            const oldest = cache.current.keys().next().value;
            if (oldest !== undefined) cache.current.delete(oldest);
          }
          cache.current.set(key, body);
          setState({ ...IDLE, status: "success", result: body });
        } else {
          setState({ ...IDLE, status: "error", error: body.error.message });
        }
      } catch {
        if (abort.signal.aborted || runId !== latestRun.current) return;
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        setState({ ...IDLE, status: "error", error: offline ? NETWORK_ERROR : UNEXPECTED_ERROR });
      }
    },
    [cancelPending],
  );

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      cancelPending();
      latestRun.current += 1;

      if (!isSearchable(value)) {
        // Nothing to look up yet: stay quiet until the visitor submits.
        setState((previous) =>
          detectInput(value).kind === "empty" ? IDLE : { ...previous, status: previous.result ? "success" : "idle", inputError: null },
        );
        return;
      }
      setState((previous) => ({ ...previous, inputError: null }));
      timer.current = setTimeout(() => void run(value), SEARCH_DEBOUNCE_MS);
    },
    [cancelPending, run],
  );

  const submit = useCallback(() => void run(query), [run, query]);

  const showText = useCallback(
    (value: string) => {
      cancelPending();
      latestRun.current += 1;
      setQueryState(value);
    },
    [cancelPending],
  );

  const searchFor = useCallback(
    (value: string) => {
      setQueryState(value);
      void run(value);
    },
    [run],
  );

  const clear = useCallback(() => {
    cancelPending();
    latestRun.current += 1;
    setQueryState("");
    setState(IDLE);
  }, [cancelPending]);

  const loadMore = useCallback(async () => {
    const current = state.result;
    if (!current || current.nextOffset === null || state.loadingMore) return;

    const runId = latestRun.current;
    const abort = new AbortController();
    controller.current = abort;
    setState((previous) => ({ ...previous, loadingMore: true, loadMoreError: null }));

    try {
      const body = await fetchSearch(
        new URLSearchParams({
          q: current.query,
          offset: String(current.nextOffset),
          provider: current.provider.id,
        }),
        abort.signal,
      );
      if (runId !== latestRun.current) return;
      if (body.ok) {
        setState((previous) =>
          previous.result
            ? {
                ...previous,
                loadingMore: false,
                result: {
                  ...previous.result,
                  tracks: mergeTracks(previous.result.tracks, body.tracks),
                  nextOffset: body.nextOffset,
                },
              }
            : previous,
        );
      } else {
        setState((previous) => ({
          ...previous,
          loadingMore: false,
          loadMoreError: body.error.message,
        }));
      }
    } catch {
      if (abort.signal.aborted || runId !== latestRun.current) return;
      setState((previous) => ({ ...previous, loadingMore: false, loadMoreError: UNEXPECTED_ERROR }));
    }
  }, [state.result, state.loadingMore]);

  return {
    query,
    ...state,
    canSubmit: query.trim().length > 0,
    setQuery,
    showText,
    searchFor,
    submit,
    clear,
    loadMore: () => void loadMore(),
  };
}
