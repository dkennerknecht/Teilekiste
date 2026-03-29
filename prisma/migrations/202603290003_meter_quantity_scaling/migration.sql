UPDATE "Item"
SET "stock" = "stock" * 1000
WHERE "unit" = 'M';

UPDATE "Item"
SET "minStock" = "minStock" * 1000
WHERE "unit" = 'M'
  AND "minStock" IS NOT NULL;

UPDATE "Reservation"
SET "reservedQty" = "reservedQty" * 1000
WHERE "itemId" IN (
  SELECT "id"
  FROM "Item"
  WHERE "unit" = 'M'
);

UPDATE "StockMovement"
SET "delta" = "delta" * 1000
WHERE "itemId" IN (
  SELECT "id"
  FROM "Item"
  WHERE "unit" = 'M'
);

UPDATE "AuditLog"
SET "before" = CASE
      WHEN "before" IS NOT NULL AND json_valid("before") THEN json_set(
        "before",
        '$.stock',
        CASE
          WHEN json_type("before", '$.stock') IN ('integer', 'real') THEN CAST(json_extract("before", '$.stock') AS INTEGER) * 1000
          ELSE json_extract("before", '$.stock')
        END,
        '$.unit',
        'M'
      )
      ELSE "before"
    END,
    "after" = CASE
      WHEN "after" IS NOT NULL AND json_valid("after") THEN json_set(
        "after",
        '$.stock',
        CASE
          WHEN json_type("after", '$.stock') IN ('integer', 'real') THEN CAST(json_extract("after", '$.stock') AS INTEGER) * 1000
          ELSE json_extract("after", '$.stock')
        END,
        '$.delta',
        CASE
          WHEN json_type("after", '$.delta') IN ('integer', 'real') THEN CAST(json_extract("after", '$.delta') AS INTEGER) * 1000
          ELSE json_extract("after", '$.delta')
        END,
        '$.unit',
        'M'
      )
      ELSE "after"
    END
WHERE "action" = 'STOCK_MOVEMENT'
  AND "entity" = 'Item'
  AND "entityId" IN (
    SELECT "id"
    FROM "Item"
    WHERE "unit" = 'M'
  );

UPDATE "AuditLog"
SET "after" = CASE
      WHEN "after" IS NOT NULL AND json_valid("after") THEN json_set(
        "after",
        '$.reservedQty',
        CASE
          WHEN json_type("after", '$.reservedQty') IN ('integer', 'real') THEN CAST(json_extract("after", '$.reservedQty') AS INTEGER) * 1000
          ELSE json_extract("after", '$.reservedQty')
        END,
        '$.unit',
        'M'
      )
      ELSE "after"
    END
WHERE "action" = 'RESERVATION_CREATE'
  AND "entity" = 'Item'
  AND "entityId" IN (
    SELECT "id"
    FROM "Item"
    WHERE "unit" = 'M'
  );

UPDATE "AuditLog"
SET "before" = CASE
      WHEN "before" IS NOT NULL AND json_valid("before") THEN json_set(
        "before",
        '$.reservedQty',
        CASE
          WHEN json_type("before", '$.reservedQty') IN ('integer', 'real') THEN CAST(json_extract("before", '$.reservedQty') AS INTEGER) * 1000
          ELSE json_extract("before", '$.reservedQty')
        END,
        '$.unit',
        'M'
      )
      ELSE "before"
    END
WHERE "action" = 'RESERVATION_DELETE'
  AND "entity" = 'Item'
  AND "entityId" IN (
    SELECT "id"
    FROM "Item"
    WHERE "unit" = 'M'
  );
