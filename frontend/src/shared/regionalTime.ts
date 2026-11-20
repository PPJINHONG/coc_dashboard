export const REGION_TIME = {
  KR: { zone: "Asia/Seoul", label: "KST" },
  EU: { zone: "Europe/Berlin", label: "CET / CEST" },
  NA: { zone: "America/Los_Angeles", label: "PST / PDT" },
} as const;

export type ScheduleRegion = keyof typeof REGION_TIME;

export function regionalInput(instant: string | Date, region: ScheduleRegion): string {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: REGION_TIME[region].zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  return formatter.format(new Date(instant)).replace(" ", "T");
}

export function nextHour() {
  return new Date((Math.floor(Date.now() / 3_600_000) + 1) * 3_600_000);
}

// On a clock change, try the previous day's offset first (the first occurrence of a repeated hour).
function wallInstant(value: string, region: ScheduleRegion, original?: string): Date | undefined {
  if (original && regionalInput(original, region) === value) return new Date(original);
  const wall = Date.parse(value + "Z");
  if (!Number.isFinite(wall)) return;
  for (const day of [-1, 1]) {
    const probe = new Date(wall + day * 86_400_000);
    const offset = Date.parse(regionalInput(probe, region) + "Z") - probe.getTime();
    const instant = new Date(wall - offset);
    if (regionalInput(instant, region) === value) return instant;
  }
}

export function changeScheduleRegion(value: string, from: ScheduleRegion, to: ScheduleRegion, original?: string): string {
  const instant = wallInstant(value, from, original);
  return instant ? regionalInput(instant, to) : value;
}

export function scheduleZoneLabel(value: string, region: ScheduleRegion, original?: string) {
  if (region === "KR") return "KST";
  const instant = wallInstant(value, region, original);
  if (!instant) return REGION_TIME[region].label;
  const formatter = new Intl.DateTimeFormat(region === "EU" ? "en-GB" : "en-US", {
    timeZone: REGION_TIME[region].zone, timeZoneName: "short",
  });
  return formatter.formatToParts(instant).find((part) => part.type === "timeZoneName")?.value ?? REGION_TIME[region].label;
}
