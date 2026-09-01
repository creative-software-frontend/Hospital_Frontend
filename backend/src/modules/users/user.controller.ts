import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as userService from "./user.service";

/**
 * GET /api/users
 * Lists users (branch-scoped, filterable, paginated).
 */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.listUsers(req.user!, req.query as never);
  res.status(200).json({ success: true, data: result });
});

/**
 * GET /api/users/:id
 */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUser(req.user!, Number(req.params.id));
  res.status(200).json({ success: true, data: { user } });
});

/**
 * POST /api/users
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.createUser(req.user!, req.body);
  res.status(201).json({ success: true, message: "User created successfully" });
});

/**
 * PATCH /api/users/:id
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUser(req.user!, Number(req.params.id), req.body);
  res.status(200).json({ success: true, message: "User updated successfully", data: { user } });
});

/**
 * PATCH /api/users/:id/status
 */
export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUserStatus(req.user!, Number(req.params.id), req.body);
  res.status(200).json({
    success: true,
    message: "User status updated successfully",
    data: { user },
  });
});
