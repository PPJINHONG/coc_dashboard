import { useLayoutEffect, useRef, useState } from "react";
import type { Chapter } from "../../shared/report/loadReport";
import { noticeMeta, noticeTitle, paginateNotices, type Notice, type NoticePage } from "./noticePagination";
import "./noticePages.css";

function Story({ meta, title, text }: { meta: string; title: string; text: string }) {
  return <article className="notice-page-story"><small>{meta}</small><h3>{title}</h3><p>{text}</p></article>;
}

function PageTimeline({ columns }: { columns: NoticePage }) {
  const events = new Map<number, Notice>();
  for (const { event } of columns.flat()) events.set(event.id, event);

  return <figure className="notice-page-timeline">
    <figcaption>작업 타임라인</figcaption>
    {events.size ? <ol>{Array.from(events.values(), (event) => {
      const day = event.at.slice(0, 10);
      return <li key={event.id}>
        <time dateTime={day}>{day.slice(5).replace("-", ".")}</time>
        <span className="timeline-marker" aria-hidden="true" />
        <strong title={event.title}>{event.title}</strong>
      </li>;
    })}</ol> : <p>예정된 작업이 없습니다.</p>}
  </figure>;
}

export default function NoticePages({ chapter, events }: { chapter: Chapter; events: Notice[] }) {
  const probe = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<NoticePage[]>([]);
  useLayoutEffect(() => {
    const box = probe.current!;
    let active = true;
    let lastWidth = 0;
    const layout = () => {
      if (!active || !box.clientWidth) return;
      lastWidth = box.clientWidth;
      setPages(paginateNotices(events, box.querySelector("article")!, box.clientHeight - 2));
    };
    layout();
    const observer = new ResizeObserver(() => { if (box.clientWidth !== lastWidth) layout(); });
    observer.observe(box);
    void document.fonts.ready.then(layout);
    return () => { active = false; observer.disconnect(); };
  }, [events]);
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.region, (counts.get(event.region) ?? 0) + 1);
  const regionalCounts = Array.from(counts).sort(([a], [b]) => a.localeCompare(b))
    .map(([region, count]) => `${region} ${count}건`).join(" · ");
  return <div className="notice-report">
    <div className="notice-measure" aria-hidden="true" ref={probe}><Story meta="" title="" text=""/></div>
    {pages.map((columns, i) => <section className="notice-report-page" key={i} aria-label={`${chapter.label} ${i + 1}쪽`}>
      <header className="notice-report-header"><div><h2>{chapter.label}</h2><p>{chapter.scope} · 월간 {events.length}건{regionalCounts && " · " + regionalCounts}</p></div>
        <span>{i + 1} / {pages.length}</span></header>
      <div className="notice-page-columns">{!events.length && <p>등록된 작업공지가 없습니다.</p>}
        {columns.map((parts, col) => <div key={col}>{parts.map(({ event, text, continued }) =>
          <Story key={event.id} meta={noticeMeta(event)} title={noticeTitle(event, continued)} text={text}/>)}</div>)}
      </div>
      <PageTimeline columns={columns}/>
    </section>)}
  </div>;
}
