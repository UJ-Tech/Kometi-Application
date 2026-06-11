-- SQL Schema for Kometi Committees and Related Tables
-- You can run this in the Supabase SQL Editor if the Prisma migrations haven't been applied.

-- 1. Create Enums if they don't exist
DO $$ BEGIN
    CREATE TYPE "CommitteeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Committees Table
CREATE TABLE IF NOT EXISTS "committees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizerId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "status" "CommitteeStatus" NOT NULL DEFAULT 'DRAFT',
    "totalSlots" INTEGER NOT NULL,
    "filledSlots" INTEGER NOT NULL DEFAULT 0,
    "installmentAmountPaise" BIGINT NOT NULL,
    "cycleDurationDays" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "currentCycleNo" INTEGER NOT NULL DEFAULT 0,
    "penaltyRatePct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 3,
    "commissionRatePct" DECIMAL(65,30) NOT NULL DEFAULT 5.0,
    "maxDiscountPct" DECIMAL(65,30) NOT NULL DEFAULT 30.0,
    "rules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committees_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "committees_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "committees_inviteCode_key" ON "committees"("inviteCode");
CREATE INDEX IF NOT EXISTS "committees_organizerId_status_idx" ON "committees"("organizerId", "status");
CREATE INDEX IF NOT EXISTS "committees_inviteCode_idx" ON "committees"("inviteCode");

-- 3. Create Committee Members Table
CREATE TABLE IF NOT EXISTS "committee_members" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasReceivedPayout" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "committee_members_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "committee_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "committee_members_committeeId_userId_key" ON "committee_members"("committeeId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "committee_members_committeeId_slotNumber_key" ON "committee_members"("committeeId", "slotNumber");
CREATE INDEX IF NOT EXISTS "committee_members_committeeId_idx" ON "committee_members"("committeeId");

-- 4. Create Join Requests Table
CREATE TABLE IF NOT EXISTS "join_requests" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "join_requests_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "join_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "join_requests_committeeId_userId_key" ON "join_requests"("committeeId", "userId");
CREATE INDEX IF NOT EXISTS "join_requests_committeeId_status_idx" ON "join_requests"("committeeId", "status");
CREATE INDEX IF NOT EXISTS "join_requests_userId_idx" ON "join_requests"("userId");

-- 5. Create Payout Cycles Table
CREATE TABLE IF NOT EXISTS "payout_cycles" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "cycleNo" INTEGER NOT NULL,
    "winnerId" TEXT NOT NULL,
    "winnerSlot" INTEGER NOT NULL,
    "payoutAmtPaise" BIGINT NOT NULL,
    "bidAmountPaise" BIGINT,
    "payoutDate" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_cycles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payout_cycles_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payout_cycles_committeeId_cycleNo_key" ON "payout_cycles"("committeeId", "cycleNo");
