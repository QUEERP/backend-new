-- 1. Create Enums if not exist
DO $$ BEGIN
    CREATE TYPE "MilestoneStatus" AS ENUM ('DRAFT', 'NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'DELAYED', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MilestoneDependencyType" AS ENUM ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MilestoneItemKind" AS ENUM ('DELIVERABLE', 'ACCEPTANCE_CRITERIA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns to ProjectMilestone safely
ALTER TABLE "ProjectMilestone"
  ADD COLUMN IF NOT EXISTS "milestoneCode" TEXT,
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "typeId" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" TEXT,
  ADD COLUMN IF NOT EXISTS "planningId" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expectedCompletion" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "actualCompletion" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reminderEnabled" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reminderDaysBefore" INTEGER,
  ADD COLUMN IF NOT EXISTS "projectManagerId" TEXT,
  ADD COLUMN IF NOT EXISTS "approverId" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "watcherIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "isBilling" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "estimatedCost" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "riskLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "riskMitigation" TEXT,
  ADD COLUMN IF NOT EXISTS "completionNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

-- 3. Convert status column to MilestoneStatus enum with explicit mapping
ALTER TABLE "ProjectMilestone"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "ProjectMilestone"
  ALTER COLUMN "status" TYPE "MilestoneStatus" USING (
    CASE 
      WHEN LOWER(TRIM("status"::text)) IN ('draft') THEN 'DRAFT'::"MilestoneStatus"
      WHEN LOWER(TRIM("status"::text)) IN ('pending', 'not_started', 'not started', 'planned') THEN 'NOT_STARTED'::"MilestoneStatus"
      WHEN LOWER(TRIM("status"::text)) IN ('in progress', 'in_progress', 'active') THEN 'IN_PROGRESS'::"MilestoneStatus"
      WHEN LOWER(TRIM("status"::text)) IN ('at risk', 'at_risk') THEN 'AT_RISK'::"MilestoneStatus"
      WHEN LOWER(TRIM("status"::text)) IN ('delayed') THEN 'DELAYED'::"MilestoneStatus"
      WHEN LOWER(TRIM("status"::text)) IN ('completed', 'done') THEN 'COMPLETED'::"MilestoneStatus"
      WHEN LOWER(TRIM("status"::text)) IN ('cancelled', 'canceled') THEN 'CANCELLED'::"MilestoneStatus"
      ELSE 'NOT_STARTED'::"MilestoneStatus"
    END
  );

ALTER TABLE "ProjectMilestone"
  ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED'::"MilestoneStatus";

-- 4. Backfill milestoneCode as MIL-0001... per businessId ordered by createdAt BEFORE unique constraint
WITH numbered_milestones AS (
  SELECT 
    id,
    'MIL-' || LPAD(ROW_NUMBER() OVER (PARTITION BY "businessId" ORDER BY "createdAt" ASC, id ASC)::text, 4, '0') AS generated_code
  FROM "ProjectMilestone"
  WHERE "milestoneCode" IS NULL OR "milestoneCode" = ''
)
UPDATE "ProjectMilestone" pm
SET "milestoneCode" = nm.generated_code
FROM numbered_milestones nm
WHERE pm.id = nm.id;

ALTER TABLE "ProjectMilestone"
  ALTER COLUMN "milestoneCode" SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMilestone_businessId_milestoneCode_key'
  ) THEN
    ALTER TABLE "ProjectMilestone" 
      ADD CONSTRAINT "ProjectMilestone_businessId_milestoneCode_key" UNIQUE ("businessId", "milestoneCode");
  END IF;
END $$;

-- 5. Backfill the link from Planning matching milestone name in the same project
UPDATE "ProjectMilestone" pm
SET "planningId" = pp.id
FROM "ProjectPlanning" pp
WHERE pm."projectId" = pp."projectId"
  AND pm."businessId" = pp."businessId"
  AND pp."milestone" IS NOT NULL
  AND TRIM(pp."milestone") != ''
  AND LOWER(TRIM(pm.name)) = LOWER(TRIM(pp."milestone"))
  AND pm."planningId" IS NULL;

-- 6. Create MilestoneItem table
CREATE TABLE IF NOT EXISTS "MilestoneItem" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "milestoneId" TEXT NOT NULL,
  "kind" "MilestoneItemKind" NOT NULL,
  "title" TEXT NOT NULL,
  "ownerId" TEXT,
  "isDone" BOOLEAN NOT NULL DEFAULT false,
  "doneAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MilestoneItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MilestoneItem_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 7. Create MilestoneDependency table
CREATE TABLE IF NOT EXISTS "MilestoneDependency" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "milestoneId" TEXT NOT NULL,
  "predecessorId" TEXT NOT NULL,
  "type" "MilestoneDependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
  "lagDays" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MilestoneDependency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MilestoneDependency_milestoneId_predecessorId_key" UNIQUE ("milestoneId", "predecessorId"),
  CONSTRAINT "MilestoneDependency_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MilestoneDependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "ProjectMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 8. Add foreign keys to ProjectMilestone
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMilestone_planningId_fkey'
  ) THEN
    ALTER TABLE "ProjectMilestone" 
      ADD CONSTRAINT "ProjectMilestone_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "ProjectPlanning"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMilestone_projectManagerId_fkey'
  ) THEN
    ALTER TABLE "ProjectMilestone" 
      ADD CONSTRAINT "ProjectMilestone_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMilestone_approverId_fkey'
  ) THEN
    ALTER TABLE "ProjectMilestone" 
      ADD CONSTRAINT "ProjectMilestone_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMilestone_invoiceId_fkey'
  ) THEN
    ALTER TABLE "ProjectMilestone" 
      ADD CONSTRAINT "ProjectMilestone_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 9. Create indexes
CREATE INDEX IF NOT EXISTS "ProjectMilestone_businessId_projectId_idx" ON "ProjectMilestone"("businessId", "projectId");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_planningId_idx" ON "ProjectMilestone"("planningId");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_businessId_status_idx" ON "ProjectMilestone"("businessId", "status");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_businessId_dueDate_idx" ON "ProjectMilestone"("businessId", "dueDate");

CREATE INDEX IF NOT EXISTS "MilestoneItem_milestoneId_kind_idx" ON "MilestoneItem"("milestoneId", "kind");
CREATE INDEX IF NOT EXISTS "MilestoneItem_businessId_idx" ON "MilestoneItem"("businessId");

CREATE INDEX IF NOT EXISTS "MilestoneDependency_predecessorId_idx" ON "MilestoneDependency"("predecessorId");
CREATE INDEX IF NOT EXISTS "MilestoneDependency_businessId_idx" ON "MilestoneDependency"("businessId");

