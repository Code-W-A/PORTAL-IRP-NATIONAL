"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PublicInfoRequest } from "@/app/(admin-irp)/registru-informatii-publice/_core/types";
import {
  formatRequestNumberDate,
  formatResponseNumberDate,
} from "@/app/(admin-irp)/registru-informatii-publice/_core/stats";
import { REQUESTER_TYPE_LABELS, REQUEST_TYPE_LABELS } from "@/app/(admin-irp)/registru-informatii-publice/_core/types";

type PublicInfoRequestTableProps = {
  items: PublicInfoRequest[];
  onEdit: (item: PublicInfoRequest) => void;
  onDelete: (item: PublicInfoRequest) => void;
};

export default function PublicInfoRequestTable({
  items,
  onEdit,
  onDelete,
}: PublicInfoRequestTableProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
        Nu există solicitări pentru filtrele selectate.
      </div>
    );
  }

  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-3">Nr. și data cererii</th>
            <th className="px-3 py-3">Modalitate primire</th>
            <th className="px-3 py-3">Solicitant</th>
            <th className="px-3 py-3">PF/PJ</th>
            <th className="px-3 py-3">Informațiile solicitate</th>
            <th className="px-3 py-3">Domeniu</th>
            <th className="px-3 py-3">Natura răsp.</th>
            <th className="px-3 py-3">Comunicare</th>
            <th className="px-3 py-3">Termen</th>
            <th className="px-3 py-3">Nr. și data răsp.</th>
            <th className="px-3 py-3">Acțiuni</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-gray-100 align-top hover:bg-gray-50/70">
              <td className="px-3 py-3 whitespace-nowrap">
                <div className="font-medium text-gray-900">{formatRequestNumberDate(item)}</div>
                <div className="text-xs text-gray-500">{REQUEST_TYPE_LABELS[item.requestType]}</div>
              </td>
              <td className="px-3 py-3">{item.receiveMethod || "—"}</td>
              <td className="px-3 py-3">{item.requesterName || "—"}</td>
              <td className="px-3 py-3">{REQUESTER_TYPE_LABELS[item.requesterType]}</td>
              <td className="max-w-xs px-3 py-3">
                <div className="line-clamp-3 whitespace-pre-wrap">{item.requestedInformation || "—"}</div>
              </td>
              <td className="px-3 py-3">{item.interestDomain || "—"}</td>
              <td className="px-3 py-3">{item.responseNature || "—"}</td>
              <td className="px-3 py-3">{item.communicationMethod || "—"}</td>
              <td className="px-3 py-3">{item.termDays ?? "—"}</td>
              <td className="px-3 py-3 whitespace-nowrap">{formatResponseNumberDate(item)}</td>
              <td className="px-3 py-3">
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onDelete(item)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
