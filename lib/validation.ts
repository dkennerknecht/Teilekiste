import { z } from "zod";

const uuidSchema = z.string().uuid();
const nameSchema = z.string().trim().min(1).max(120);
const codeSchema = z.string().trim().min(1).max(40);

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

export const itemUpdateSchema = itemSchema.partial();

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

export const adminUserUpdateSchema = adminUserSchema.partial().extend({
  id: uuidSchema
});

export const idPayloadSchema = z.object({
  id: uuidSchema
});

export const itemIdPayloadSchema = z.object({
  itemId: uuidSchema
});

export const namePayloadSchema = z.object({
  name: nameSchema
});

export const idNamePayloadSchema = z.object({
  id: uuidSchema,
  name: nameSchema
});

export const inventoryUpdateSchema = z.object({
  updates: z.array(
    z.object({
      itemId: uuidSchema,
      countedStock: z.number().int(),
      note: z.string().max(500).optional()
    })
  ).default([])
});

export const storageLocationCreateSchema = z.object({
  name: nameSchema,
  code: z.string().trim().max(40).optional().nullable()
});

export const storageLocationUpdateSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  code: z.string().trim().max(40).optional().nullable()
});

export const customFieldCreateSchema = z.object({
  name: nameSchema,
  key: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(40),
  options: z.unknown().optional(),
  required: z.boolean().optional(),
  categoryId: uuidSchema.optional().nullable()
});

export const customFieldUpdateSchema = customFieldCreateSchema.partial().extend({
  id: uuidSchema,
  isActive: z.boolean().optional()
});

export const areaCreateSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  active: z.boolean().optional()
});

export const labelTypeCreateSchema = z.object({
  areaId: uuidSchema,
  code: codeSchema,
  name: nameSchema,
  active: z.boolean().optional()
});

export const labelConfigSchema = z.object({
  separator: z.string().trim().min(1).max(5).optional(),
  digits: z.coerce.number().int().min(2).max(6).optional(),
  prefix: z.string().max(40).optional().nullable(),
  suffix: z.string().max(40).optional().nullable(),
  recycleNumbers: z.boolean().optional(),
  delimiter: z.string().trim().min(1).max(5).optional(),
  allowCodeEdit: z.boolean().optional(),
  regenerateOnType: z.boolean().optional()
});

export const bulkItemSchema = z.object({
  itemIds: z.array(uuidSchema).min(1),
  categoryId: uuidSchema.optional(),
  storageLocationId: uuidSchema.optional(),
  storageArea: z.string().max(120).optional().nullable(),
  bin: z.string().max(120).optional().nullable(),
  minStock: z.number().int().optional().nullable(),
  unit: z.enum(["STK", "M", "SET", "PACK"]).optional(),
  addTagIds: z.array(uuidSchema).optional(),
  removeTagIds: z.array(uuidSchema).optional(),
  areaId: uuidSchema.optional(),
  typeId: uuidSchema.optional(),
  dryRun: z.boolean().optional()
});

export const orderedImageIdsSchema = z.object({
  orderedImageIds: z.array(uuidSchema).min(1)
});

export const apiTokenCreateSchema = z.object({
  userId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  expiresAt: z.string().trim().min(1).optional().nullable()
});

export const bomEntrySchema = z.object({
  childItemId: uuidSchema,
  qty: z.number().int().positive().max(9999)
});

export const backupRestoreSchema = z.object({
  strategy: z.enum(["merge", "overwrite"]).default("merge"),
  dryRun: z.boolean().optional().default(true)
});
