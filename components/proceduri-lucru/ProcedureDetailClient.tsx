"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Star } from "lucide-react";

import type { Procedure } from "@/lib/proceduri-lucru/types";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProcedureExecution from "@/components/proceduri-lucru/ProcedureExecution";

type ProcedureDetailClientProps = {
  procedure: Procedure;
};

type TocItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

const statusLabelMap: Record<Procedure["status"], string> = {
  active: "Activ",
  draft: "Draft",
  deprecated: "Deprecat",
};

const statusClassMap: Record<Procedure["status"], string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  deprecated: "bg-gray-100 text-gray-600 border-gray-200",
};

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function buildToc(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const slugCounts = new Map<string, number>();
  const items: TocItem[] = [];

  lines.forEach((line) => {
    const match = /^(##|###)\s+(.*)$/.exec(line.trim());
    if (!match) return;
    const level = match[1] === "##" ? 2 : 3;
    const title = match[2].trim();
    const baseSlug = slugifyHeading(title);
    const currentCount = slugCounts.get(baseSlug) ?? 0;
    const id = currentCount ? `${baseSlug}-${currentCount}` : baseSlug;
    slugCounts.set(baseSlug, currentCount + 1);
    items.push({ id, title, level });
  });

  return items;
}

function flattenText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const element = node as { props?: { children?: React.ReactNode } };
    return flattenText(element.props?.children);
  }
  return "";
}

export default function ProcedureDetailClient({ procedure }: ProcedureDetailClientProps) {
  const [copied, setCopied] = useState(false);
  const toc = useMemo(() => buildToc(procedure.contentMarkdown), [procedure.contentMarkdown]);
  const headingIds = useMemo(() => toc.map((item) => item.id), [toc]);
  const headingIndexRef = useRef(0);
  headingIndexRef.current = 0;

  async function handleCopyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Acasă</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/proceduri-lucru">Proceduri de lucru</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{procedure.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusClassMap[procedure.status]}>
              {statusLabelMap[procedure.status]}
            </Badge>
            <Badge variant="outline">{procedure.category}</Badge>
            {procedure.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="bg-gray-50 text-gray-600">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="text-3xl font-semibold text-gray-900">{procedure.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Actualizat: {procedure.updatedAt}</span>
            {procedure.owner && <span>Owner: {procedure.owner}</span>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="prezentare" className="w-full">
        <TabsList>
          <TabsTrigger value="prezentare">Prezentare</TabsTrigger>
          <TabsTrigger value="executa">Execută</TabsTrigger>
          <TabsTrigger value="versiuni">Versiuni</TabsTrigger>
        </TabsList>

        <TabsContent value="prezentare">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card>
              <CardHeader>
                <CardTitle>Prezentare</CardTitle>
              </CardHeader>
              <CardContent>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => {
                      const id = headingIds[headingIndexRef.current++] ?? slugifyHeading(flattenText(children));
                      return (
                        <h2 id={id} className="mt-6 scroll-mt-24 text-xl font-semibold text-gray-900">
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ children }) => {
                      const id = headingIds[headingIndexRef.current++] ?? slugifyHeading(flattenText(children));
                      return (
                        <h3 id={id} className="mt-4 scroll-mt-24 text-lg font-semibold text-gray-900">
                          {children}
                        </h3>
                      );
                    },
                    p: ({ children }) => <p className="mt-3 text-sm leading-6 text-gray-700">{children}</p>,
                    ul: ({ children }) => <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">{children}</ul>,
                    ol: ({ children }) => <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                  }}
                >
                  {procedure.contentMarkdown}
                </ReactMarkdown>
              </CardContent>
            </Card>

            <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <Card>
                <CardHeader>
                  <CardTitle>Cuprins</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[60vh] pr-2">
                    <div className="space-y-2">
                      {toc.length === 0 ? (
                        <div className="text-sm text-gray-500">Nu există secțiuni.</div>
                      ) : (
                        toc.map((item) => (
                          <a
                            key={item.id}
                            href={`#${item.id}`}
                            className={`block text-sm text-gray-600 hover:text-gray-900 ${
                              item.level === 3 ? "pl-3" : ""
                            }`}
                          >
                            {item.title}
                          </a>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Acțiuni rapide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                    Copiază link
                  </Button>
                  <Button variant="ghost">
                    <Star className="h-4 w-4" />
                    Marchează ca favorit
                  </Button>
                  {copied && <div className="text-xs text-emerald-600">Link copiat</div>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="executa">
          <ProcedureExecution slug={procedure.slug} steps={procedure.steps} />
        </TabsContent>

        <TabsContent value="versiuni">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Istoric versiuni</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-700">
                  <span>v1.0</span>
                  <span>{procedure.updatedAt}</span>
                </div>
                <Separator className="my-3" />
                <div className="text-sm text-gray-500">Alte versiuni vor fi adăugate ulterior.</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
