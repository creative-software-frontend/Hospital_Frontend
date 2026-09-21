import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { list } from "../../utils/apiResponse";
import * as auditService from "./audit.service";
import type { ListAuditQuery } from "./audit.validation";

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as ListAuditQuery;
  const result = await auditService.listAuditLogs(req.user!, query);
  list(res, result.data, result.pagination);
});

function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  let text: string;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === "object") {
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export const exportAuditLogsCsv = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as ListAuditQuery;
  const rows = await auditService.exportAuditLogs(req.user!, query);

  const header = [
    "id",
    "createdAt",
    "module",
    "action",
    "tableName",
    "recordId",
    "branchId",
    "branchName",
    "userId",
    "userEmail",
    "userName",
    "ipAddress",
    "newValues",
    "oldValues",
  ].map(csvCell).join(",");

  const body = rows
    .map((r) =>
      [
        r.id,
        r.createdAt,
        r.module,
        r.action,
        r.tableName ?? "",
        r.recordId ?? "",
        r.branchId,
        r.branch?.name ?? "",
        r.userId ?? "",
        r.user?.email ?? "",
        r.user?.name ?? "",
        r.ipAddress ?? "",
        r.newValues ?? "",
        r.oldValues ?? "",
      ]
        .map(csvCell)
        .join(","),
    )
    .join("\n");

  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(`${header}\n${body}${body ? "\n" : ""}`);
});