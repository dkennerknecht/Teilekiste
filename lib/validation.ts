import { z } from "zod";

export const itemSchema = z.object({
  labelCode: z.string().optional(),
  name: z.string().min(2).max(180),
  description: z.string().max(8000).default(""),
  categoryId: z.string().uuid(),
  storageLocationId: z.string().uuid(),
  storageArea: z.string().optional().nullable(),
  bin: z.string().optional().nullable(),
  stock: z.number().int().default(0),
  unit: z.enum(["STK", "M", "SET", "PACK"]).default("STK"),
  minStock: z.number().int().optional().nullable(),
  manufacturer: z.string().max(180).optional().nullable(),
  mpn: z.string().max(180).optional().nullable(),
  datasheetUrl: z.string().url().optional().nullable(),
  purchaseUrl: z.string().url().optional().nullable(),
  barcodeEan: z.string().max(64).optional().nullable(),
  areaId: z.string().uuid(),
  typeId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).default([]),
  customValues: z.record(z.any()).optional().default({})
});

export const stockMovementSchema = z.object({
  delta: z.number().int().refine((value) => value !== 0),
  reason: z.enum(["PURCHASE", "CONSUMPTION", "CORRECTION", "INVENTORY", "RESERVATION"]),
  note: z.string().optional().nullable()
});

export const reservationSchema = z.object({
  reservedQty: z.number().int().positive(),
  reservedFor: z.string().min(1).max(200),
  note: z.string().optional().nullable()
});

export const adminUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(["ADMIN", "READ_WRITE", "READ"]).default("READ"),
  isActive: z.boolean().optional().default(true),
  allowedLocationIds: z.array(z.string().uuid()).optional().default([])
});

export const backupRestoreSchema = z.object({
  strategy: z.enum(["merge", "overwrite"]).default("merge")
});
