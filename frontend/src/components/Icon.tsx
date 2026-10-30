import type { CSSProperties } from "react";

export type IconName =
  | "home"
  | "grid"
  | "cloud"
  | "server"
  | "users"
  | "person"
  | "work"
  | "flag"
  | "history"
  | "database"
  | "arrow"
  | "chevron"
  | "search"
  | "refresh"
  | "eye"
  | "panel"
  | "download"
  | "sort"
  | "globe"
  | "layers"
  | "check"
  | "settings"
  | "logout"
  | "close"
  | "shield";
const paths: Record<IconName, string[]> = {
  person: ["M20 21v-2a7 7 0 0 0-14 0v2", "M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"],
  home: ["m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"],
  grid: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  cloud: ["M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.6 10 4 4 0 0 1 18 18Z"],
  server: ["M4 3h16v7H4zM4 14h16v7H4zM7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87",
    "M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  ],
  work: ["M8 5V3h8v2M3 6h18v14H3zM3 11h18M10 11v3h4v-3"],
  flag: ["M4 22V3M4 4c5-4 11 4 16 0v12c-5 4-11-4-16 0"],
  history: ["M3 12a9 9 0 1 0 3-6.7M3 3v5h5M12 7v5l3 2"],
  database: [
    "M3 6c0-5 18-5 18 0s-18 5-18 0M3 6v12c0 5 18 5 18 0V6M3 12c0 5 18 5 18 0",
  ],
  arrow: ["M5 12h14M13 6l6 6-6 6"],
  chevron: ["m9 5 7 7-7 7"],
  search: ["M21 21l-4.5-4.5", "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  refresh: [
    "M20 7a9 9 0 0 0-15-2L2 8M2 2v6h6M4 17a9 9 0 0 0 15 2l3-3M22 22v-6h-6",
  ],
  eye: [
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12",
    "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
  panel: ["M3 3h18v18H3zM9 3v18"],
  download: ["M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"],
  sort: ["M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4"],
  globe: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
  ],
  layers: ["m12 3 10 5-10 5L2 8ZM2 12l10 5 10-5M2 16l10 5 10-5"],
  check: ["m5 12 4 4L19 6"],
  settings: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z",
  ],
  logout: ["M9 3H3v18h6M10 12h12m-5-5 5 5-5 5"],
  close: ["m6 6 12 12M6 18 18 6"],
  shield: ["m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6ZM8 12l3 3 5-6"],
};
export default function Icon({
  name,
  size = 18,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name].map((path, index) => (
        <path d={path} key={index} />
      ))}
    </svg>
  );
}
