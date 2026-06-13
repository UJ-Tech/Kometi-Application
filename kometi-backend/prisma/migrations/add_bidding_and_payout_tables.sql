-- SQL Schema Migration: Bidding and Payout System

-- Enable pgcrypto extension for gen_random_uuid() if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create custom ENUM types
DO $$ BEGIN
    CREATE TYPE "committee_month_status" AS ENUM ('pending', 'bidding_open', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "resolution_type" AS ENUM ('bid_single', 'bid_auction', 'lottery');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "bid_status" AS ENUM ('pending', 'won', 'lost', 'withdrawn');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "contribution_status" AS ENUM ('pending', 'paid', 'late', 'defaulted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "disbursement_type" AS ENUM ('bid_payout', 'lottery_payout');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create committee_months table
CREATE TABLE IF NOT EXISTS "committee_months" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "committee_id" UUID NOT NULL,
    "month_number" INTEGER NOT NULL CHECK ("month_number" >= 1 AND "month_number" <= 30),
    "month_date" TIMESTAMP(3) NOT NULL,
    "total_pool" BIGINT NOT NULL,
    "status" "committee_month_status" NOT NULL DEFAULT 'pending',
    "winner_member_id" UUID,
    "winning_bid_amount" BIGINT,
    "remaining_balance" BIGINT NOT NULL DEFAULT 0,
    "organiser_fee" BIGINT NOT NULL DEFAULT 0,
    "distributable_amount" BIGINT NOT NULL DEFAULT 0,
    "interest_amount" BIGINT NOT NULL DEFAULT 0,
    "per_member_distribution" BIGINT NOT NULL DEFAULT 0,
    "resolution_type" "resolution_type" NOT NULL,
    "bidding_deadline" TIMESTAMP(3),

    CONSTRAINT "committee_months_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "committee_months_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "committee_months_winner_member_id_fkey" FOREIGN KEY ("winner_member_id") REFERENCES "committee_members"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Index and Unique constraints for committee_months
CREATE UNIQUE INDEX IF NOT EXISTS "committee_months_committee_id_month_number_key" ON "committee_months"("committee_id", "month_number");
CREATE INDEX IF NOT EXISTS "committee_months_committee_id_idx" ON "committee_months"("committee_id");

-- 3. Create bids table
-- Drop the existing bids table from the old schema first to prevent column mismatch errors
DROP TABLE IF EXISTS "bids" CASCADE;

CREATE TABLE "bids" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "committee_id" UUID NOT NULL,
    "month_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "bid_amount" BIGINT NOT NULL,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "bid_status" NOT NULL DEFAULT 'pending',

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bids_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bids_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "committee_months"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bids_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "committee_members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint so one member cannot bid twice per month
CREATE UNIQUE INDEX IF NOT EXISTS "bids_month_id_member_id_key" ON "bids"("month_id", "member_id");
-- Index on (committee_id, month_id)
CREATE INDEX IF NOT EXISTS "bids_committee_id_month_id_idx" ON "bids"("committee_id", "month_id");

-- 4. Create monthly_contributions table
CREATE TABLE IF NOT EXISTS "monthly_contributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "committee_id" UUID NOT NULL,
    "month_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "amount_due" BIGINT NOT NULL,
    "amount_paid" BIGINT NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "late_weeks" INTEGER NOT NULL DEFAULT 0,
    "late_fee_amount" BIGINT NOT NULL DEFAULT 0,
    "status" "contribution_status" NOT NULL DEFAULT 'pending',

    CONSTRAINT "monthly_contributions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "monthly_contributions_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "monthly_contributions_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "committee_months"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "monthly_contributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "committee_members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint so one member has only one contribution record per month
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_contributions_month_id_member_id_key" ON "monthly_contributions"("month_id", "member_id");
-- Index on (committee_id, month_id)
CREATE INDEX IF NOT EXISTS "monthly_contributions_committee_id_month_id_idx" ON "monthly_contributions"("committee_id", "month_id");

-- 5. Create fund_disbursements table
CREATE TABLE IF NOT EXISTS "fund_disbursements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "committee_id" UUID NOT NULL,
    "month_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "disbursement_type" "disbursement_type" NOT NULL,
    "amount" BIGINT NOT NULL,
    "disbursed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "fund_disbursements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fund_disbursements_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fund_disbursements_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "committee_months"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fund_disbursements_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "committee_members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index on (committee_id, month_id)
CREATE INDEX IF NOT EXISTS "fund_disbursements_committee_id_month_id_idx" ON "fund_disbursements"("committee_id", "month_id");

-- 6. Create member_distributions table
CREATE TABLE IF NOT EXISTS "member_distributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "committee_id" UUID NOT NULL,
    "month_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "distribution_amount" BIGINT NOT NULL,
    "interest_share" BIGINT NOT NULL DEFAULT 0,
    "organiser_fee_share" BIGINT NOT NULL DEFAULT 0,
    "distributed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_distributions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "member_distributions_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "member_distributions_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "committee_months"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "member_distributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "committee_members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint so one member has only one distribution record per month
CREATE UNIQUE INDEX IF NOT EXISTS "member_distributions_month_id_member_id_key" ON "member_distributions"("month_id", "member_id");
-- Index on (committee_id, month_id)
CREATE INDEX IF NOT EXISTS "member_distributions_committee_id_month_id_idx" ON "member_distributions"("committee_id", "month_id");
