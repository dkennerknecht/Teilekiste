import { describe, expect, it, vi } from "vitest";
import { getCustomFieldPreset } from "@/lib/custom-field-presets";
import {
  removeTechnicalFieldScopeAssignment,
  syncTechnicalFieldScopeAssignment,
  TechnicalFieldAssignmentError
} from "@/lib/technical-field-assignments";

function createAssignmentDb(input?: {
  existingManagedFields?: Array<Record<string, unknown>>;
  conflictingNames?: string[];
}) {
  const existingManagedFields = input?.existingManagedFields || [];
  const conflictingNames = new Set(input?.conflictingNames || []);

  const customFieldFindManyMock = vi.fn().mockImplementation(async (args?: any) => {
    if (args?.where?.key?.startsWith) return [];
    if (args?.where?.managedPresetFieldKey?.not === null && args?.include) return [];
    if (args?.where?.managedPresetFieldKey?.not === null) return existingManagedFields;
    return [];
  });

  return {
    technicalFieldScopeAssignment: {
      upsert: vi.fn().mockImplementation(async ({ create, update }: any) => ({
        id: "assignment-1",
        ...create,
        ...update
      })),
      findUnique: vi.fn().mockResolvedValue({
        id: "assignment-1",
        categoryId: "11111111-1111-4111-8111-111111111111",
        typeId: "22222222-2222-4222-8222-222222222222",
        presetKey: "resistor"
      }),
      delete: vi.fn().mockResolvedValue({})
    },
    customField: {
      findMany: customFieldFindManyMock,
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        if (conflictingNames.has(where.name)) {
          return { id: "free-field" };
        }
        return null;
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        id: `created-${data.managedPresetFieldKey}`,
        ...data
      })),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
}

describe("technical field assignments", () => {
  it("reactivates matching managed fields and deactivates stale ones on preset sync", async () => {
    const preset = getCustomFieldPreset("resistor");
    if (!preset) throw new Error("Expected resistor preset");

    const db = createAssignmentDb({
      existingManagedFields: [
        {
          id: "reactivate-field",
          name: "Wert",
          categoryId: "11111111-1111-4111-8111-111111111111",
          typeId: "22222222-2222-4222-8222-222222222222",
          managedPresetKey: "resistor",
          managedPresetFieldKey: "resistance-value",
          isActive: false,
          sortOrder: 0
        },
        {
          id: "stale-field",
          name: "Kapazitaet",
          categoryId: "11111111-1111-4111-8111-111111111111",
          typeId: "22222222-2222-4222-8222-222222222222",
          managedPresetKey: "capacitor",
          managedPresetFieldKey: "capacitance-value",
          isActive: true,
          sortOrder: 1
        }
      ]
    });

    const result = await syncTechnicalFieldScopeAssignment(db as never, {
      categoryId: "11111111-1111-4111-8111-111111111111",
      typeId: "22222222-2222-4222-8222-222222222222",
      presetKey: "resistor"
    });

    expect(result.reactivatedFieldIds).toEqual(["reactivate-field"]);
    expect(result.deactivatedFieldIds).toEqual(["stale-field"]);
    expect(db.customField.create).toHaveBeenCalledTimes(preset.fields.length - 1);
    expect(db.customField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["stale-field"] } },
        data: expect.objectContaining({ isActive: false, technicalFieldScopeAssignmentId: "assignment-1" })
      })
    );
  });

  it("is idempotent for already synchronized scopes", async () => {
    const preset = getCustomFieldPreset("resistor");
    if (!preset) throw new Error("Expected resistor preset");

    const db = createAssignmentDb({
      existingManagedFields: preset.fields.map((field, index) => ({
        id: `field-${field.key}`,
        name: field.name,
        categoryId: "11111111-1111-4111-8111-111111111111",
        typeId: "22222222-2222-4222-8222-222222222222",
        managedPresetKey: "resistor",
        managedPresetFieldKey: field.key,
        isActive: true,
        sortOrder: index
      }))
    });

    const result = await syncTechnicalFieldScopeAssignment(db as never, {
      categoryId: "11111111-1111-4111-8111-111111111111",
      typeId: "22222222-2222-4222-8222-222222222222",
      presetKey: "resistor"
    });

    expect(result.createdFieldIds).toEqual([]);
    expect(result.reactivatedFieldIds).toEqual([]);
    expect(result.deactivatedFieldIds).toEqual([]);
    expect(db.customField.create).not.toHaveBeenCalled();
    expect(db.customField.updateMany).not.toHaveBeenCalled();
  });

  it("rejects naming conflicts with free custom fields", async () => {
    const db = createAssignmentDb({
      conflictingNames: ["Wert"]
    });

    await expect(
      syncTechnicalFieldScopeAssignment(db as never, {
        categoryId: "11111111-1111-4111-8111-111111111111",
        typeId: "22222222-2222-4222-8222-222222222222",
        presetKey: "resistor"
      })
    ).rejects.toBeInstanceOf(TechnicalFieldAssignmentError);

    expect(db.customField.create).not.toHaveBeenCalled();
  });

  it("deactivates managed fields when removing an assignment", async () => {
    const db = createAssignmentDb();

    const removed = await removeTechnicalFieldScopeAssignment(db as never, {
      id: "assignment-1"
    });

    expect(removed).toMatchObject({ id: "assignment-1" });
    expect(db.customField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoryId: "11111111-1111-4111-8111-111111111111",
          typeId: "22222222-2222-4222-8222-222222222222",
          managedPresetFieldKey: { not: null }
        }),
        data: {
          isActive: false,
          technicalFieldScopeAssignmentId: null
        }
      })
    );
    expect(db.technicalFieldScopeAssignment.delete).toHaveBeenCalledWith({ where: { id: "assignment-1" } });
  });
});
