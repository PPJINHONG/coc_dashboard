import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ReportContext } from "../featureReport";
import { loadReport, type Chapter } from "./loadReport";

export function useMonthlyReport({ snapshot, data, features, user }: ReportContext, documentName: string) {
  const [issue, setIssue] = useState<{ chapters: Chapter[]; generated: Date }>();
  const chapters = issue?.chapters;
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const publication = useRef<HTMLDivElement>(null);
  const read = useEffectEvent(() => loadReport({ snapshot, data, features, user }));
  const sourceIds = features.map(({ id }) => id).join("/");

  useEffect(() => {
    let current = true;
    setIssue(undefined);
    setError("");
    read().then((result) => {
      if (current) setIssue({ chapters: result, generated: new Date() });
    }).catch((cause: Error) => {
      if (current) setError(cause.message);
    });
    return () => { current = false; };
  }, [snapshot, data, sourceIds, user, attempt]);

  useEffect(() => {
    const previous = document.title;
    document.title = documentName;
    return () => { document.title = previous; };
  }, [documentName]);

  async function printReport() {
    const target = publication.current;
    if (!target || !chapters || preparing) return;
    setPreparing(true);
    try {
      await Promise.all([
        document.fonts.ready,
        ...Array.from(target.querySelectorAll("img"), (img) => img.decode().catch(() => undefined)),
      ]);
      if (publication.current === target) window.print();
    } finally {
      setPreparing(false);
    }
  }

  const ordered = ["resources", "regional_handovers", "regional_notices", "regional_requests"]
    .flatMap((id) => chapters?.filter((chapter) => chapter.id === id) ?? []);

  return { issue, chapters, ordered, error, retry: () => setAttempt((n) => n + 1), preparing, publication, printReport };
}
