import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function success<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ success: true, data });
}

export function list<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  statusCode = 200,
): Response {
  return res.status(statusCode).json({ success: true, data, pagination });
}
