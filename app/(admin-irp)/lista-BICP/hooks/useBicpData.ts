"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";

export type Bicp = {
  id: string;
  numar: number;
  tip: "BI" | "CI" | "PC";
  titlu: string;
  descriere?: string;
  data?: any; // DD/MM/YYYY string sau Firestore Timestamp în vechile înregistrări
  dataTimestamp?: any; // Firestore Timestamp (nou)
  judet: string;
  linkPdf?: string;
  linkExtern?: string;
  // câmpuri specifice noii forme
  numarComunicat?: string | number;
  nume?: string; // tip document text
  comunicat?: string;
  numeAfisare?: string;
  pentru?: string;
  functia?: string;
  grad?: string;
  numeSemnatar?: string;
  ["purtator-cuvant"]?: string;
  pdfLink?: string;
  wordLink?: string;
};

export type Filters = {
  search: string;
  tip: string[]; // BI/CI/PC (fallback)
  tipDocument: string; // "Buletin Informativ" etc.
  semnatarCat: string; // categorii semnatar
  numarMin?: number;
  numarMax?: number;
  dataStart?: string;
  dataEnd?: string;
  sortBy: "numar" | "data" | "titlu" | "numarComunicat" | "nume";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

const defaultFilters: Filters = {
  search: "",
  tip: [],
  tipDocument: "",
  semnatarCat: "",
  sortBy: "numar",
  sortDir: "desc",
  page: 1,
  pageSize: 10,
};

export function useBicpData() {
  const { db } = initFirebase();
  const [items, setItems] = useState<Bicp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const saved = localStorage.getItem("bicpFilters");
      return saved ? { ...defaultFilters, ...JSON.parse(saved) } : defaultFilters;
    } catch {
      return defaultFilters;
    }
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { judetId, structuraId } = getTenantContext();
        const snap = await getDocs(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate"));
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Bicp[];
        setItems(data);
      } catch (e) {
        setError("Eroare la încărcare");
      } finally {
        setLoading(false);
      }
    })();
  }, [db, version]);

  useEffect(() => {
    localStorage.setItem("bicpFilters", JSON.stringify(filters));
  }, [filters]);

  const filtered = useMemo(() => {
    let arr = [...items];
    const { search, tip, tipDocument, semnatarCat, numarMin, numarMax, dataStart, dataEnd } = filters;
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter((x) => {
        const fields = [
          x.titlu,
          String(x.numar ?? ""),
          String(x.numarComunicat ?? ""),
          x.data ? String(x.data) : "",
          x.numeAfisare ?? "",
          x.comunicat ?? "",
          x.nume ?? "",
          x.numeSemnatar ?? "",
        ].map((v) => String(v).toLowerCase());
        return fields.some((f) => f.includes(s));
      });
    }
    if (tip.length) arr = arr.filter((x) => tip.includes(x.tip));
    if (tipDocument) arr = arr.filter((x) => (x.nume || "").toLowerCase() === tipDocument.toLowerCase());
    if (semnatarCat) {
      const key = semnatarCat.toLowerCase();
      arr = arr.filter((x) => [x.numeSemnatar, x.pentru, x.functia].filter(Boolean).map((y) => String(y).toLowerCase()).some((v) => v.includes(key)));
    }
    if (numarMin != null) arr = arr.filter((x) => x.numar >= numarMin);
    if (numarMax != null) arr = arr.filter((x) => x.numar <= numarMax);
    const parseDate = (item: Bicp): Date | null => {
      if (item.dataTimestamp?.toDate) return item.dataTimestamp.toDate();
      if (item.data && typeof item.data === "string") {
        const [dd, mm, yyyy] = item.data.split("/");
        if (dd && mm && yyyy) return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      }
      if ((item as any).data?.toDate) return (item as any).data.toDate();
      return null;
    };
    if (dataStart) arr = arr.filter((x) => {
      const d = parseDate(x);
      return d ? d >= new Date(dataStart) : true;
    });
    if (dataEnd) arr = arr.filter((x) => {
      const d = parseDate(x);
      return d ? d <= new Date(dataEnd) : true;
    });
    return arr;
  }, [items, filters]);

  const sorted = useMemo(() => {
    const { sortBy, sortDir } = filters;
    const m = [...filtered].sort((a, b) => {
      let av: any;
      let bv: any;
      switch (sortBy) {
        case "data": {
          const get = (x: Bicp) => {
            if (x.dataTimestamp?.toDate) return x.dataTimestamp.toDate().getTime();
            if (x.data && typeof x.data === "string") {
              const [dd, mm, yyyy] = x.data.split("/");
              if (dd && mm && yyyy) return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
            }
            if ((x as any).data?.toDate) return (x as any).data.toDate().getTime();
            return 0;
          };
          av = get(a); bv = get(b);
          break;
        }
        case "numarComunicat":
          av = Number(a.numarComunicat ?? a.numar ?? 0);
          bv = Number(b.numarComunicat ?? b.numar ?? 0);
          break;
        case "nume":
          av = a.nume || ""; bv = b.nume || "";
          break;
        case "titlu":
          av = a.titlu || ""; bv = b.titlu || "";
          break;
        default:
          av = Number((a as any)[sortBy] ?? 0);
          bv = Number((b as any)[sortBy] ?? 0);
      }
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv);
      return (av as number) - (bv as number);
    });
    return sortDir === "desc" ? m.reverse() : m;
  }, [filtered, filters]);

  const paged = useMemo(() => {
    const { page, pageSize } = filters;
    const start = (page - 1) * pageSize;
    return {
      total: sorted.length,
      items: sorted.slice(start, start + pageSize),
    };
  }, [sorted, filters]);

  const reload = () => setVersion((v) => v + 1);

  return { loading, error, filters, setFilters, items: paged.items, total: paged.total, reload };
}


