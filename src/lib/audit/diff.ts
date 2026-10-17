// Comparación entre dos auditorías del mismo sitio. Puro (sin imports de la
// app). "Arreglada" solo cuenta si la URL sigue existiendo en la auditoría
// nueva: una incidencia que desaparece porque la página ya no está NO es un
// arreglo y se cuenta aparte (páginas desaparecidas).

export type DiffPage = { url: string; issues: string[] };

export type IssueChange = {
  issue: string;
  prev: number; // páginas con la incidencia en la auditoría anterior
  cur: number;
  fixed: number; // pares (URL, incidencia) que ya no están y la URL sigue existiendo
  appeared: number; // pares nuevos (incluye páginas nuevas)
  fixedSample: string[];
  appearedSample: string[];
};

export type AuditDiff = {
  newPages: number;
  removedPages: number;
  changes: IssueChange[]; // ordenadas por cambio neto: primero lo que más empeora
  totalFixed: number;
  totalAppeared: number;
};

const SAMPLE = 5;

export function diffAudits(prev: DiffPage[], cur: DiffPage[]): AuditDiff {
  const prevByUrl = new Map(prev.map((p) => [p.url, new Set(p.issues)]));
  const curByUrl = new Map(cur.map((p) => [p.url, new Set(p.issues)]));
  const acc = new Map<string, IssueChange>();
  const get = (issue: string): IssueChange => {
    let c = acc.get(issue);
    if (!c) {
      c = { issue, prev: 0, cur: 0, fixed: 0, appeared: 0, fixedSample: [], appearedSample: [] };
      acc.set(issue, c);
    }
    return c;
  };

  for (const [url, issues] of prevByUrl) {
    for (const issue of issues) {
      get(issue).prev++;
      if (curByUrl.has(url) && !curByUrl.get(url)!.has(issue)) {
        const c = get(issue);
        c.fixed++;
        if (c.fixedSample.length < SAMPLE) c.fixedSample.push(url);
      }
    }
  }
  for (const [url, issues] of curByUrl) {
    for (const issue of issues) {
      get(issue).cur++;
      if (!prevByUrl.get(url)?.has(issue)) {
        const c = get(issue);
        c.appeared++;
        if (c.appearedSample.length < SAMPLE) c.appearedSample.push(url);
      }
    }
  }

  const changes = [...acc.values()]
    .filter((c) => c.fixed > 0 || c.appeared > 0 || c.prev !== c.cur)
    .sort((a, b) => b.cur - b.prev - (a.cur - a.prev));

  return {
    newPages: [...curByUrl.keys()].filter((u) => !prevByUrl.has(u)).length,
    removedPages: [...prevByUrl.keys()].filter((u) => !curByUrl.has(u)).length,
    changes,
    totalFixed: changes.reduce((s, c) => s + c.fixed, 0),
    totalAppeared: changes.reduce((s, c) => s + c.appeared, 0),
  };
}
