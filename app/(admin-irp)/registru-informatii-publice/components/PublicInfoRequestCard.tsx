"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PublicInfoRequest } from "@/app/(admin-irp)/registru-informatii-publice/_core/types";
import {
  formatRequestDateLabel,
  formatResponseNumberDate,
} from "@/app/(admin-irp)/registru-informatii-publice/_core/stats";
import { REQUEST_TYPE_LABELS } from "@/app/(admin-irp)/registru-informatii-publice/_core/types";

type PublicInfoRequestCardProps = {
  items: PublicInfoRequest[];
  onView: (item: PublicInfoRequest) => void;
  onEdit: (item: PublicInfoRequest) => void;
  onDelete: (item: PublicInfoRequest) => void;
};

export default function PublicInfoRequestCardList({
  items,
  onView,
  onEdit,
  onDelete,
}: PublicInfoRequestCardProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600 md:hidden">
        Nu există solicitări pentru filtrele selectate.
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-gray-900">
                {item.requestNumber || "Fără număr"} · {formatRequestDateLabel(item.requestDate)}
              </div>
              <div className="text-xs text-gray-500">{REQUEST_TYPE_LABELS[item.requestType]}</div>
            </div>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
              {item.responseNature || "—"}
            </span>
          </div>

          <div className="mt-3 space-y-1 text-sm text-gray-700">
            <div>
              <span className="font-medium">Solicitant:</span> {item.requesterName || "—"}
            </div>
            <div className="line-clamp-3 whitespace-pre-wrap">{item.requestedInformation || "—"}</div>
            {item.responseDate || item.responseNumber ? (
              <div className="text-xs text-gray-500">Răspuns: {formatResponseNumberDate(item)}</div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onView(item)}>
              <Eye className="h-4 w-4" />
              Vezi
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
              <Pencil className="h-4 w-4" />
              Editează
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(item)}>
              <Trash2 className="h-4 w-4" />
              Șterge
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
