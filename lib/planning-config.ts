export interface PlanningEntry {
  displayName: string;
  dbName: string;
  departements: string[];
  belgique: boolean;
  joursDispo: number;
}

export const PLANNING: PlanningEntry[] = [
  {
    displayName: "Fadoua",
    dbName: "fadoua",
    departements: ["59", "62", "80"],
    belgique: true,
    joursDispo: 21,
  },
  {
    displayName: "Hamza",
    dbName: "hamza",
    departements: ["75", "77", "93", "94", "60"],
    belgique: false,
    joursDispo: 21,
  },
  {
    displayName: "Maissa",
    dbName: "maissa",
    departements: ["91", "92", "95", "78", "27", "76"],
    belgique: false,
    joursDispo: 21,
  },
  {
    displayName: "Zouhair",
    dbName: "zouhair",
    departements: ["09", "12", "31", "32", "33", "47", "81", "82", "66", "11"],
    belgique: false,
    joursDispo: 21,
  },
  {
    displayName: "Jassim",
    dbName: "moha",
    departements: ["06", "13", "83"],
    belgique: false,
    joursDispo: 15,
  },
  {
    displayName: "Taha",
    dbName: "taha taha",
    departements: ["01", "38", "42", "69", "73", "74"],
    belgique: false,
    joursDispo: 15,
  },
  {
    displayName: "Anas",
    dbName: "anas",
    departements: ["30", "34", "84", "26"],
    belgique: false,
    joursDispo: 15,
  },
];

export function isInTerritory(
  codePostal: string | null,
  departements: string[],
  belgique: boolean
): boolean {
  if (!codePostal) return false;
  const cp = codePostal.trim().replace(/\s+/g, "");
  if (belgique && /^[1-9]\d{3}$/.test(cp)) return true;
  for (const dept of departements) {
    if (cp.startsWith(dept) && cp.length >= 4) return true;
  }
  return false;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
