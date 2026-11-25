import { useEffect, useState } from "react";
import { request } from "../../shared/api/client";
import type { DataRow } from "../../shared/api/operations";
import { errorMessage } from "../../shared/errors";

export function monthAt(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + offset, 1)).toISOString().slice(0, 7);
}

type Months = Record<string, DataRow[]>;

export const loadResourceHistory = (month: string, length: number) =>
  request<Months>("GET", `/api/operations/resources/trend/?month=${month}&months=${length}`);

export function useResourceHistory(month: string, length: number, revision: number) {
  const [attempt, setAttempt] = useState(0);
  const key = `${month}/${length}/${revision}/${attempt}`;
  const [result, setResult] = useState<{ key: string; months?: Months; error?: string }>();
  useEffect(() => {
    let active = true;
    loadResourceHistory(month, length).then((months) => {
      if (active) setResult({ key, months });
    }).catch((err) => {
      if (active) setResult({ key, error: errorMessage(err) });
    });
    return () => { active = false; };
  }, [key, month, length]);
  const current = result?.key === key ? result : undefined;
  return { months: current?.months, error: current?.error, retry: () => setAttempt((n) => n + 1) };
}
