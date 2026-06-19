# Committee Application - Development Chat Log

## Date: June 18, 2026

---

## 1. Committee Calculation Logic Explanation

### Understanding `committeeCalculations.ts`

The file is the **pure-math engine** for the chit fund. Zero DB calls — just pure functions.

#### Core Concepts

| Concept | Meaning |
|---|---|
| **Total Pool** | All members pay their contribution → pool of money |
| **Interest** | A % of the pool charged to the winner — redistributed to all members as "earnings" |
| **Max Bid** | Pool minus interest — the winner can't take the interest, it's protected |
| **Remaining Balance** | Pool minus winning bid — leftover after winner takes their cut |
| **Organiser Fee** | A % of the *remaining balance* (not the pool!) — goes to the organiser |
| **Distributable Amount** | Remaining balance − organiser fee + interest + late fees — split equally among ALL members |
| **Conservation Check** | Ensures total money IN = total money OUT — no rupee is created or destroyed |

#### 5-Member Example

**Setup**: 5 members, ₹1,000/month, 2% interest, 5% organiser fee

**Month 1 — Alice Wins (Bid ₹4,500)**:
- Total Pool: ₹5,000
- Interest: 2% × ₹1,000 × 5 = ₹100
- Max Bid: ₹4,900
- Remaining Balance: ₹500
- Organiser Fee: ₹25
- Distributable: ₹575
- Per Member: ₹115
- Alice Net: ₹4,515 (₹4,500 payout − ₹100 interest + ₹115 distribution)
- Others Net: +₹115 each

**Month 2 — Bob Wins (Bid ₹4,600)**:
- Interest: 2% × ₹1,000 × 4 = ₹80
- Per Member: ₹92
- Bob Net: ₹4,612

**Month 3 — Charlie Wins (Bid ₹4,700)**:
- Interest: ₹60, Per Member: ₹69

**Month 4 — Dave Wins (Bid ₹4,800)**:
- Interest: ₹40, Per Member: ₹46

**Month 5 — Eve (Last Member, Lottery, Full Pool)**:
- Interest: ₹20, Per Member: ₹4
- Eve Net: ₹4,984

**Key Insights**:
- Early winners get money early but at a discount
- Late winners get most money back but wait longest
- Interest decreases each month as fewer non-winners remain
- Organiser earns ₹70 total across all months

---

## 2. Feature: Committee Size Adjustment

### Requirement
- No actions can be performed until ALL members join
- If members say there are enough, organizer can reduce totalSlots
- After adjusting, everything unlocks

### Backend Changes

**New endpoint**: `POST /:id/adjust-size`

**committees.validator.ts**:
```typescript
export const adjustCommitteeSizeSchema = z.object({
  body: z.object({
    newTotalSlots: z.number().int().min(2).max(50),
  }),
});
```

**committees.service.ts** — `adjustCommitteeSize()`:
- Only works on DRAFT committees
- Can only reduce slots (not increase)
- Can't reduce below `filledSlots`
- Returns `isNowFull` flag

**committees.controller.ts** — `adjustCommitteeSize` handler

**committees.router.ts** — `POST /:id/adjust-size` (organizer-only)

### Frontend Changes

**committees.api.ts**:
```typescript
adjustCommitteeSize: (id: string, newTotalSlots: number) =>
  apiClient.post(`/committees/${id}/adjust-size`, { newTotalSlots }),
```

**committees/[id]/index.tsx**:
- "Waiting for Members" card with progress bar
- "Adjust Committee Size" button with inline form
- "Committee Not Ready" member-facing notice
- "Start Committee" button only shows when `filledSlots === totalSlots`

### Enforcement Chain
- `startCommittee()` checks `filledSlots !== totalSlots` → throws
- `submitBid()` checks `committee.status !== "ACTIVE"` → throws
- `resolveAuction()` checks `committee.status !== "ACTIVE"` → throws

---

## 3. Bug Fix: confirmAction/Alert on Mobile

### Problem
On mobile, when the keyboard is open, the first tap on a TouchableOpacity dismisses the keyboard instead of firing onPress.

### Solution
```typescript
<TouchableOpacity
  onPress={() => {
    Keyboard.dismiss();
    setTimeout(() => handleAdjustSize(), 100);
  }}
  disabled={isAdjusting}
  activeOpacity={0.7}
>
```

- Separate `isAdjusting` state (not shared with `isSubmitting`)
- `Keyboard.dismiss()` + `setTimeout` defers action until keyboard is gone
- `activeOpacity={0.7}` for visual feedback

---

## 4. Bug Fix: organiserFeePercent Undefined

### Problem
`committeeMonths.service.ts` passed `feePercent` but `calculateMonthSummary` expects `organiserFeePercent`.

### Fix
All 5 `calculateMonthSummary` call sites updated:
- Renamed `feePercent` → `organiserFeePercent`
- Added missing required fields: `committeeId`, `monthNumber`, `interestRatePercent`, `winnerId`, `resolutionType`, `contributions`
- Fixed import: `calculateLateFee` → `calculateLateFeeForMember`
- Fixed `calculateLastMemberTotal` missing 3rd argument

---

## 5. Complete Committee Lifecycle Flow

### After Clicking "Start Chit Committee":

```
START (all slots filled)
  │
  ▼
CREATE MONTH (organizer, N times)
  │
  ▼
MEMBERS PAY CONTRIBUTIONS
  │
  ▼ (all paid?)
OPEN BIDDING (48hr deadline)
  │
  ▼
MEMBERS PLACE BIDS (can update anytime)
  │
  ▼
RESOLVE MONTH
  │  ├─ Calculate interest, fees
  │  ├─ Credit winner (bid payout)
  │  ├─ Debit winner (interest)
  │  ├─ Credit ALL members (distribution)
  │  ├─ Debit platform (organiser fee)
  │  ├─ Conservation check ✓
  │  └─ Mark winner as done
  │
  ▼
NEXT MONTH? ── YES ──→ back to CREATE MONTH
  │
  ▼ NO (all months done)
COMPLETED
```

### Who Can Do What

| Action | Organizer | Members | Condition |
|---|---|---|---|
| Create Month | ✅ | ❌ | ACTIVE status |
| Open Bidding | ✅ | ❌ | All members paid |
| Place Bid | ❌ | ✅ | bidding_open, not won before, paid |
| Resolve Month | ✅ | ❌ | bidding_open |
| Pay Contribution | ✅ | ✅ | ACTIVE, current cycle |
| View Audit Log | ✅ | ✅ | Any status |

### Monthly Math (per resolution)

| Step | Formula |
|---|---|
| Total Pool | N × contribution |
| Interest | rate% × contribution × remainingNonWinners |
| Max Bid | Pool − Interest |
| Remaining Balance | Pool − Winning Bid |
| Organiser Fee | fee% × Remaining Balance |
| Distributable | Remaining − OrgFee + Interest + LateFees |
| Per Member | Distributable ÷ N |

### Wallet Ledger (per resolution)

| Entry | Member | Direction | Amount |
|---|---|---|---|
| bid_payout | Winner | CREDIT | Winning Bid |
| interest_charge | Winner | DEBIT | Interest |
| distribution_credit | ALL | CREDIT | Per Member Share |
| organiser_fee_charge | Platform | DEBIT | Organiser Fee |

---

## Files Modified

### Backend
- `kometi-backend/src/modules/committees/committees.validator.ts`
- `kometi-backend/src/modules/committees/committees.service.ts`
- `kometi-backend/src/modules/committees/committees.controller.ts`
- `kometi-backend/src/modules/committees/committees.router.ts`
- `kometi-backend/src/modules/committeeMonths/committeeMonths.service.ts`

### Frontend
- `src/services/committees.api.ts`
- `src/app/(app)/committees/[id]/index.tsx`
