import type { MonthlyQuotaTargets } from "@/features/cuotas/domain/monthly-types";

export type WeightedPerson = {
  id: string;
  days: number;
};

type Allocation = Record<string, number>;

function allocateInteger(total: number, people: WeightedPerson[]): Allocation {
  const result: Allocation = Object.fromEntries(
    people.map((person) => [person.id, 0]),
  );
  const normalizedTotal = Math.max(0, Math.round(total));
  const totalDays = people.reduce(
    (sum, person) => sum + Math.max(0, Math.round(person.days)),
    0,
  );

  if (normalizedTotal === 0 || totalDays === 0) return result;

  const raw = people.map((person, index) => {
    const days = Math.max(0, Math.round(person.days));
    const exact = (normalizedTotal * days) / totalDays;
    const base = Math.floor(exact);

    return {
      id: person.id,
      index,
      base,
      fraction: exact - base,
    };
  });

  let assigned = raw.reduce((sum, item) => sum + item.base, 0);
  for (const item of raw) result[item.id] = item.base;

  const ranked = [...raw].sort(
    (a, b) => b.fraction - a.fraction || a.index - b.index,
  );

  let cursor = 0;
  while (assigned < normalizedTotal && ranked.length > 0) {
    const item = ranked[cursor % ranked.length];
    result[item.id] += 1;
    assigned += 1;
    cursor += 1;
  }

  return result;
}

function allocateMoney(total: number, people: WeightedPerson[]): Allocation {
  const cents = allocateInteger(Math.round(Math.max(0, total) * 100), people);

  return Object.fromEntries(
    Object.entries(cents).map(([id, value]) => [id, value / 100]),
  );
}

export function distributeMonthlyTargets(
  targets: Omit<MonthlyQuotaTargets, "amt">,
  people: WeightedPerson[],
): Record<string, MonthlyQuotaTargets> {
  const hhpFp = allocateMoney(targets.hhpFp, people);
  const hhpMass = allocateMoney(targets.hhpMass, people);
  const tabs = allocateMoney(targets.tabs, people);
  const acc = allocateMoney(targets.acc, people);
  const scPlus = allocateMoney(targets.scPlus, people);
  const laminas = allocateInteger(targets.laminas, people);

  return Object.fromEntries(
    people.map((person) => {
      const personHhpFp = hhpFp[person.id] ?? 0;
      const personHhpMass = hhpMass[person.id] ?? 0;
      const personTabs = tabs[person.id] ?? 0;
      const personAcc = acc[person.id] ?? 0;

      return [
        person.id,
        {
          hhpFp: personHhpFp,
          hhpMass: personHhpMass,
          tabs: personTabs,
          acc: personAcc,
          amt:
            Math.round(
              (personHhpFp +
                personHhpMass +
                personTabs +
                personAcc) *
                100,
            ) / 100,
          scPlus: scPlus[person.id] ?? 0,
          laminas: laminas[person.id] ?? 0,
        },
      ];
    }),
  );
}

export function monthlyAmt(
  values: Pick<MonthlyQuotaTargets, "hhpFp" | "hhpMass" | "tabs" | "acc">,
) {
  return (
    Math.round(
      (values.hhpFp + values.hhpMass + values.tabs + values.acc) * 100,
    ) / 100
  );
}

export function commercialEndDate(
  startDate: string,
  weeks: 4 | 5,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return "";

  const date = new Date(startDate + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + weeks * 7 - 1);
  return date.toISOString().slice(0, 10);
}
