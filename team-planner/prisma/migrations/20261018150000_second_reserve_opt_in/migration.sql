ALTER TABLE "Lineup" ALTER COLUMN "hideSecondReserve" SET DEFAULT true;

-- Keep occupied second reserve slots visible in either match.
UPDATE "Lineup" AS l
SET "hideSecondReserve" = true
WHERE NOT EXISTS (
  SELECT 1 FROM "LineupPlayer" p
  WHERE p."lineupId" = l.id
    AND (p."sortOrder" = 9 OR p."sortOrder" = l."secondMatchSlots"[10])
);

-- Keep the hidden slot outside the nine editable positions in match 2.
UPDATE "Lineup" AS l
SET "secondMatchSlots" = ARRAY(
  SELECT CASE WHEN ordinal = 10 THEN 9
              WHEN slot = 9 THEN l."secondMatchSlots"[10]
              ELSE slot END
  FROM unnest(l."secondMatchSlots") WITH ORDINALITY AS positions(slot, ordinal)
  ORDER BY ordinal
)
WHERE l."hideSecondReserve" AND cardinality(l."secondMatchSlots") = 10;
