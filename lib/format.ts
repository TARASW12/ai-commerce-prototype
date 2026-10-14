import type { Program } from "@/adapters/types";

export function utcHHMM(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function days(p: Program) {
  const d = p.schedule.recurrence.byDay;
  return d.includes("SA") && d.includes("SU")
    ? "Saturday and Sunday"
    : d.join(", ");
}
