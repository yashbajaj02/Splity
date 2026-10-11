# Splity Production UX Contracts

Scope: UI and interaction contracts for the existing React + TanStack Router + React Query + Supabase app. This document does not authorize schema, RLS, API, or settlement-ledger changes.

## Non-negotiable behaviour
- Preserve the existing brand tokens in `src/styles.css`: Sora display type, Inter body type, emerald primary, slate neutrals, rose for amounts owed, and current light/dark theme tokens.
- Settlement actions remain distinct: **Pay** opens the UPI QR/payment flow; **Paid** records a payment already made and keeps UPI/cash choices; **Remind** sends a reminder and respects its cooldown.
- Partial payments remain supported. A successful partial payment reduces the remaining amount; the outstanding amount and expense-level history remain visible until settled.
- Do not modify Supabase schema, row-level security policies, or settlement API contracts as part of visual polish.
- Do not mark a payment as successful until the mutation succeeds. On failure, keep the dialog open and explain the failure; prevent duplicate submissions while pending.
- Keep server-derived amounts authoritative; never calculate final balances solely from display state.

## Screen states
- **Loading:** stable layout, visible progress indicator, no misleading zero balance.
- **Loaded with balances:** show net balance and separate “You owe” / “Owed to you” lists. Amount direction must be communicated by text as well as colour.
- **Empty:** explicitly say no one is owed / the user owes nobody; do not render a blank list.
- **Error:** explain which data failed to load and provide a retry action. Do not expose raw backend or policy details to end users.
- **Mutation pending:** disable the triggering action and show a busy state; avoid duplicate writes.
- **Mutation success:** show the confirmed amount/method and refresh relevant settlement, activity, and notification queries.
- **Mutation failure:** retain user-entered values where safe and allow retry.
- **Partial payment:** make it clear that the remaining balance is not settled and retain payment history.

## Accessibility and responsive contracts
- All actions must be keyboard operable and have visible focus.
- Dialogs/sheets must have accessible titles, sensible focus behaviour, and a reachable close/cancel action when no write is pending.
- Use semantic buttons for actions; do not make colour the only indication of owe/owed state.
- Layout must work from narrow mobile widths through tablet and desktop without horizontal scrolling or clipped primary actions.
- Respect `prefers-reduced-motion`; animation is decorative and must not be required to understand balances or action state.
- Inputs must have labels, numeric amount fields must reject invalid/non-positive amounts, and validation must be presented next to the field or as an accessible announcement.

## Verification checklist
- [ ] Pay opens the existing QR flow and never records a payment merely because the QR was viewed.
- [ ] Paid supports UPI and cash, full and partial amounts, and preserves expense-level settlement history.
- [ ] Remind respects pending state and cooldown; failures are visible and retryable.
- [ ] Query loading, empty, error, success, and failure states are explicit.
- [ ] No Supabase schema/RLS/policy changes are included in a UI-only change.
- [ ] Mobile, keyboard navigation, visible focus, and reduced-motion preferences are checked.
- [ ] Run `npm run lint`, `npm run build`, and relevant E2E smoke tests before merging.
