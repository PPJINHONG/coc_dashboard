import type { ReportSource } from "../../shared/featureReport";
import { listRequests } from "./api";

export const requestReport: ReportSource = async ({ snapshot, user }) => {
  if (!user) return null;
  const [year, month] = snapshot.month.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const [current, prior] = await Promise.all([listRequests(snapshot.month), listRequests(previous)]);
  return {
    scope: "요청을 접수한 리전 기준",
    requests: { month: snapshot.month, previous, regions: ["KR", "EU", "NA"].map((region) => ({
      region, now: current.filter((row) => row.region === region).length,
      prior: prior.filter((row) => row.region === region).length,
    })) },
  };
};
