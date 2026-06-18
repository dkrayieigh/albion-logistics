# Sale Valuation Workflow

## 1. Purpose

This document defines the business workflow for the sale valuation calculator and crafted item sale popup.

The valuation calculator is not an automatic pricing engine. Its purpose is to support P2P sale price decisions by giving the user a structured reference point before entering the actual sale price.

This document is a docs-only workflow spec. It does not implement UI, change sale writers, change transaction payloads, or modify `globalAvgCost`.

## 2. P2P Sale Context

Albion player-to-player sale discussions often use the in-game estimated value as a starting reference.

Common workflow:

- Read the in-game estimated value.
- Apply a discount such as `-10%`, `-15%`, or a custom discount.
- Use the discounted value as a negotiation reference.
- Decide the final actual sale price manually.

The estimated value and discounted value are decision support only. Actual成交價仍由使用者決定，且必須能被手動覆寫。

## 3. Valuation Calculator Inputs

The valuation calculator should support these conceptual inputs and outputs:

| Field | Purpose |
|---|---|
| Quantity | Number of crafted items being evaluated. |
| Estimated unit value | In-game estimated value per item. |
| Estimated total value | Estimated unit value multiplied by quantity. |
| Discount rate | P2P negotiation discount, such as `10%`, `15%`, or custom value. |
| Discounted unit value | Estimated unit value after discount. |
| Discounted total value | Discounted unit value multiplied by quantity. |

Synchronization rule:

- If the user enters estimated unit value, estimated total value should update from `unit * quantity`.
- If the user enters estimated total value, estimated unit value should update from `total / quantity`.
- Discounted unit and total values should update whenever quantity, estimated value, or discount rate changes.

The discounted value may be copied or applied into the sale popup as a suggested sale price, but it must remain editable.

## 4. Sale Popup Inputs

The crafted item sale popup should separate valuation reference from actual sale input.

Actual sale inputs:

| Field | Purpose |
|---|---|
| Quantity | Number of crafted items being sold. |
| Actual sale unit price | Real agreed sale price per item. |
| Actual sale total price | Real agreed total sale price. |

Synchronization rule:

- If actual sale unit price changes, actual sale total price should update from `unit * quantity`.
- If actual sale total price changes, actual sale unit price should update from `total / quantity`.
- If quantity changes, the currently active price basis should remain understandable to the user.

The sale popup may accept a suggested value from the valuation calculator, but the user must be able to manually override unit price or total price before submitting.

## 5. Cost / Profit Display

The sale popup should prioritize cost and profit clarity over tax-only estimates.

Cost basis:

- Use crafted item `globalAvgCost` as the current cost basis.
- `cost total = globalAvgCost * quantity`.
- `profit = actual sale total price - cost total`.
- `profit per item = profit / quantity`.
- `profit margin % = profit / actual sale total price * 100`.

If `globalAvgCost` is `null` or otherwise unknown:

- Display cost basis unknown.
- Do not pretend profit can be calculated.
- Allow sale workflow rules to remain separate from profit display rules.

Suggested display fields:

| Field | Formula / source |
|---|---|
| Cost basis per item | `globalAvgCost` |
| Cost total | `globalAvgCost * quantity` |
| Actual sale total | user-entered sale total |
| Estimated profit | sale total - cost total |
| Profit per item | profit / quantity |
| Profit margin | profit / sale total |

## 6. Tax Boundary

P2P sale should not use market tax as the primary display focus.

Boundary:

- P2P sale valuation is primarily about negotiated sale price, cost basis, and profit.
- Market tax should not be mixed into P2P profit display unless the user explicitly selects a future market sale mode.
- If future market sale support is added, it should be a separate market tax mode.
- Do not mix tax deduction estimate and P2P profit in the same primary number.

Current references to tax deduction estimates should be treated as legacy UI behavior / implementation pending, not as the target workflow for P2P sale decisions.

## 7. Crafting Queue Cash Cost Display Boundary

The crafting queue label "estimated total spending" needs clearer business wording.

Current cash deduction behavior:

- Craft Selected deducts cash for shop fee.
- Craft Selected deducts cash for artifact cost.
- Craft Selected deducts cash for alchemy cost.
- Materials already in inventory are consumed as inventory cost, not as a new cash deduction at craft time.

Target wording:

- Rename "預估總支出" to "本次製作現金支出".
- Split the display into:
  - 店鋪使用費
  - 神器成本
  - 鍊金成本
  - 本次製作現金支出

Accounting boundary:

- Shop fee, artifact cost, and alchemy cost are current cash deductions.
- Material cost is inventory cost consumption.
- Material cost should be included in crafted item cost basis, but it is not a cash deduction during Craft Selected if materials were already purchased earlier.

This boundary is especially important after the E1 crafting hotfix, because artifact / alchemy cash cost must be included in crafted item cost but should still be described separately from material inventory cost.

## 8. Current Implementation Notes

Current implementation already has some related behavior:

- Crafted item sale writes a legacy `賣成品` transaction.
- Crafted item sale does not modify the sold item's `globalAvgCost`.
- Sale popup currently supports unit / total price synchronization.
- Sale success toast can show estimated gross profit when cost basis is available.
- Existing valuation references remain UI reference values and do not automatically determine the transaction amount.

Implementation gaps remain:

- P2P discount workflow is not fully specified in UI.
- Estimated unit value / estimated total value workflow needs clearer separation from actual sale price.
- Profit display should become the primary sale decision support.
- Market tax display should not be the default P2P sale focus.

## 9. Non-goals

This document does not:

- Implement UI.
- Change sale writer.
- Change transaction payload.
- Change `globalAvgCost`.
- Add market tax mode.
- Change crafting formula.
- Change localStorage schema.
- Add migration code.
- Add adapter implementation.
- Change backup import/export logic.
- Create a repair tool.
- Repair historical crafting data.
- Decide E6 implementation scope.
