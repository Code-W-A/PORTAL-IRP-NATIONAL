"use client";

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export default function ReportToast({ toast }: { toast: ToastState }) {
  if (!toast) return null;

  return (
    <div className="fixed right-4 top-4 z-[90]">
      <div
        className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${
          toast.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}

export type { ToastState };
