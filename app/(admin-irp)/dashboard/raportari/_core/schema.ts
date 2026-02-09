import { z } from "zod";

export const reportColumnWidthSchema = z.enum(["s", "m", "l"]);
export const reportColumnKindSchema = z.enum(["text", "textarea"]);
export const periodPresetSchema = z.enum(["previous_month", "previous_year", "custom"]);

export const reportTypeColumnSchema = z.object({
  id: z.string().min(1, "ID-ul coloanei este obligatoriu."),
  label: z.string().min(1, "Numele coloanei este obligatoriu."),
  kind: reportColumnKindSchema,
  width: reportColumnWidthSchema,
  required: z.boolean().default(false),
  order: z.number().int().min(0),
});

export const reportTypeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Numele tipului este obligatoriu."),
    description: z.string().min(1, "Descrierea tipului este obligatorie."),
    columns: z.array(reportTypeColumnSchema).min(1, "Adaugă cel puțin o coloană."),
    archived: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.columns.forEach((column, index) => {
      if (seen.has(column.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ID coloană duplicat.",
          path: ["columns", index, "id"],
        });
      }
      seen.add(column.id);
    });
  });

export const reportRowSchema = z.object({
  id: z.string().min(1, "ID rând invalid."),
  cells: z.record(z.string(), z.string()),
});

export const reportInstanceSchema = z
  .object({
    id: z.string().optional(),
    typeId: z.string().min(1, "Tipul de raport este obligatoriu."),
    typeNameSnapshot: z.string().min(1, "Numele tipului este obligatoriu."),
    typeDescriptionSnapshot: z.string().min(1, "Descrierea tipului este obligatorie."),
    columnsSnapshot: z.array(reportTypeColumnSchema).min(1, "Tipul raportului nu are coloane."),
    title: z.string().min(1, "Titlul raportului este obligatoriu."),
    registrationNumber: z.string().min(1, "Numărul de înregistrare este obligatoriu."),
    periodPreset: periodPresetSchema,
    periodStart: z.string().min(1, "Data de început este obligatorie."),
    periodEnd: z.string().min(1, "Data de final este obligatorie."),
    rows: z.array(reportRowSchema),
  })
  .superRefine((value, ctx) => {
    if (value.periodStart > value.periodEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Perioada este invalidă: începutul trebuie să fie înainte de final.",
        path: ["periodStart"],
      });
    }

    value.rows.forEach((row, rowIndex) => {
      value.columnsSnapshot.forEach((column) => {
        if (!column.required) return;
        const cell = String(row.cells[column.id] || "").trim();
        if (!cell) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Coloana \"${column.label}\" este obligatorie.`,
            path: ["rows", rowIndex, "cells", column.id],
          });
        }
      });
    });
  });

export const reportExportSchema = z.object({
  report: reportInstanceSchema,
  includeSignatures: z.boolean().default(true),
});

export type ReportTypeInput = z.infer<typeof reportTypeSchema>;
export type ReportInstanceInput = z.infer<typeof reportInstanceSchema>;
export type ReportExportInput = z.infer<typeof reportExportSchema>;
export type ReportRowInput = z.infer<typeof reportRowSchema>;
export type ReportTypeColumnInput = z.infer<typeof reportTypeColumnSchema>;
