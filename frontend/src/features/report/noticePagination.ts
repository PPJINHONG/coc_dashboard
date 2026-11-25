import type { ReportContent } from "../../shared/featureReport";

export type Notice = NonNullable<ReportContent["timeline"]>[number];
export type NoticePart = { event: Notice; text: string; continued: boolean };
export type NoticePage = [NoticePart[], NoticePart[]];

// Keep each notice on the single horizontal timeline of its printed page.
const maxPageNotices = 6;

export const noticeMeta = (event: Notice) =>
  [event.at, event.region, event.category].filter(Boolean).join(" · ");
export const noticeTitle = (event: Notice, continued: boolean) => event.title + (continued ? " (계속)" : "");

// The probe uses the same column width, typography and spacing as a printed article.
export function paginateNotices(events: Notice[], probe: HTMLElement, columnHeight: number): NoticePage[] {
  const meta = probe.querySelector("small")!;
  const heading = probe.querySelector("h3")!;
  const body = probe.querySelector("p")!;
  const height = (text: string) => {
    body.textContent = text;
    return probe.getBoundingClientRect().height;
  };

  const pages: NoticePage[] = [[[], []]];
  let column = 0;
  let room = columnHeight;
  const noticeIds = new Set<number>();
  const nextPage = () => {
    pages.push([[], []]);
    noticeIds.clear();
    column = 0;
    room = columnHeight;
  };
  const nextColumn = () => {
    if (column === 1) nextPage();
    else { column = 1; room = columnHeight; }
  };

  for (const event of events) {
    if (noticeIds.size === maxPageNotices) nextPage();
    meta.textContent = noticeMeta(event);
    const content = event.content || "작업 상세 내용 미등록";
    let offset = 0;
    while (offset < content.length) {
      const continued = offset > 0;
      heading.textContent = noticeTitle(event, continued);
      // Bound the initial measurement for unusually long notices, then grow if it fits.
      const remaining = content.length - offset;
      let end = Math.min(4096, remaining);
      const measure = (length: number) => height(content.slice(offset, offset + length));
      while (end < remaining && measure(end) <= columnHeight) end = Math.min(remaining, end * 2);
      const fullHeight = measure(end);
      if (room < columnHeight && fullHeight > room &&
          (fullHeight <= columnHeight || height("") + 42 > room)) {
        nextColumn();
        continue;
      }
      if (fullHeight > room) {
        let low = 0, high = end;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (measure(middle) <= room) low = middle;
          else high = middle - 1;
        }
        end = Math.max(1, low);
        // Prefer a nearby word boundary and keep UTF-16 surrogate pairs together.
        const tail = content.slice(offset + Math.max(0, end - 32), offset + end);
        const boundary = tail.match(/\s(?=\S*$)/u);
        if (boundary?.index != null) end -= tail.length - boundary.index - 1;
        if (/[\uD800-\uDBFF]/u.test(content.charAt(offset + end - 1))) end = end > 1 ? end - 1 : 2;
      }
      const text = content.slice(offset, offset + end);
      pages[pages.length - 1][column].push({ event, text, continued });
      noticeIds.add(event.id);
      room -= height(text);
      offset += end;
      if (offset < content.length) nextColumn();
    }
  }
  return pages;
}
