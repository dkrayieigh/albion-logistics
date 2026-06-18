# Crafting Hotfix Smoke Checklist

## 1. Purpose

This checklist validates the E1 crafting hotfix manually in the real UI path.

It focuses on the T5.3 審判者護甲 / Judicator Armor incident case and checks whether the UI, queue, and `submitCraftAll()` path now include artifact cost and fresh shop fee correctly.

Passing this checklist does not approve release by itself.

## 2. Preconditions

Before testing:

- Export backup before testing.
- Use test data or duplicated profile if possible.
- Do not test on the only copy of important production data.
- Confirm current branch/commit is at or after `ca1d754f35143442747b503f6ff7328671f0b63f`.
- Run `npm.cmd test` or `npm test` if possible.
- Expected automated baseline: `69 tests / 68 pass / 0 fail / 1 TODO`.

Known unresolved boundary:

- Historical crafting data may already be contaminated.
- Material safe-stock boundary remains unresolved.
- This checklist does not repair old records.

## 3. T5.3 Judicator Armor Setup

Use this setup to match the incident as closely as possible:

| Field | Value |
|---|---|
| Recipe | `審判者護甲` / Judicator Armor |
| Quality | `5.3` |
| Qty | `19` |
| City | Bridgewatch |
| Focus | Use the same setting as the incident, if known |
| Shop fee input | `690`, if matching incident setup |
| Material | `鋼條_5.3` |
| Material `globalAvgCost` | `34,980` |
| Material available | Enough for test, preferably `170+` |
| Artifact price | `200,000` each |

Recommended manual setup notes:

- Use a duplicated profile or disposable backup restore.
- Ensure cash is high enough to cover shop fee plus artifact cost.
- Confirm the test item is added to the crafting queue before entering artifact price.
- Keep screenshots or notes of queue total, transaction total, unitPrice, cash change, and resulting `globalAvgCost`.

## 4. Expected Checks

The old bug value was `61,106` shop fee for 19 pieces. That value should no longer be the result for the T5.3 Judicator Armor setup.

Expected checks:

- Shop fee should no longer show old bug value `61,106`.
- Artifact price input should update queue total.
- `submitCraftAll()` should include artifact total `3,800,000`.
- Crafted item `globalAvgCost` should be greater than `295,943`.
- Transaction `total` and `unitPrice` should include artifact cost.
- Cash deduction should include tax + artifact cost.
- Current material consumption may still use unresolved net consumption formula; do not treat safe-stock as resolved.

Suggested expected relationship:

```text
artifactTotal = 200,000 * 19 = 3,800,000
transaction total should include material cost + fresh tax + artifactTotal
unitPrice should be derived from transaction total / 19
cash deduction should include fresh tax + artifactTotal
```

Do not use this smoke checklist to validate historical data that was created before E1.

## 5. Negative / Regression Checks

Run these after the main T5.3 flow if possible:

| Check | Expected result |
|---|---|
| Change `global-shopfee` after adding queue item, then submit | Transaction should use latest shop fee, not stale queue tax |
| Edit artifact price after queue item is added | Queue total should update |
| Use an item with alchemy input | Alchemy input class should update queue total |
| Use non-artifact crafting | Fee should not obviously inflate from artifact logic |

If any negative / regression check fails, stop release readiness and record the failure.

## 6. Pass / Fail Recording Table

| Step | Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|---|
| Backup exported before test | Backup file exists and is readable |  |  |  |
| Branch/commit checked | At or after `ca1d754f` |  |  |  |
| Automated tests run if possible | `69 tests / 68 pass / 0 fail / 1 TODO` |  |  |  |
| T5.3 Judicator Armor queued | Qty 19, quality 5.3, Bridgewatch |  |  |  |
| Shop fee checked | Not old bug value `61,106` |  |  |  |
| Artifact price entered | `200,000` each |  |  |  |
| Queue total checked | Includes artifact total `3,800,000` |  |  |  |
| Submit completed | Craft succeeds without UI error |  |  |  |
| Crafted `globalAvgCost` checked | Greater than `295,943` |  |  |  |
| Transaction total checked | Includes artifact cost |  |  |  |
| Transaction unitPrice checked | Derived from total / 19 |  |  |  |
| Cash deduction checked | Includes fresh tax + artifact cost |  |  |  |
| Shop fee changed after queue add | Submit uses latest shop fee |  |  |  |
| Artifact price changed after queue add | Queue total updates |  |  |  |
| Alchemy input checked if applicable | Queue total updates |  |  |  |
| Non-artifact crafting checked | Fee does not obviously inflate |  |  |  |

## 7. Release Boundary

Passing this checklist does not repair historical data.

Passing this checklist does not resolve material safe-stock TODO.

Passing this checklist does not approve release by itself.

Release still requires Spec Lead approval and must account for:

- Historical crafting data contamination.
- Recovery plan status in `docs/CRAFTING_INCIDENT_RECOVERY.md`.
- Regression baseline status.
- Manual T5.3 smoke result.
- Release note wording for pre-E1 crafting cost risk.

## 8. Next Action After Checklist

- If pass: proceed to E4 release readiness review.
- If fail: stop release and create E4 hotfix bug report instead.
- If historical data needs repair: return to Spec Lead before any repair tool.

Do not mutate historical data as part of this checklist.

Do not create or run a repair tool as part of this checklist.

Do not change release/version number based only on this checklist.
