# Teller Console Demo

A browser-only bank teller app built with Next.js (App Router), React 19 and TypeScript. A teller can open accounts, take deposits and withdrawals, see the balance and full transaction history, and switch between customers. There is no backend: state lives in memory for the life of the page, as the brief asks.

## Running it

Requires Node 20.9+.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit + component tests (Vitest, Testing Library)
npm run typecheck    # tsc --noEmit, strict mode
npm run build        # production build
npm run test:coverage
```

## How it's structured

```
src/
  domain/          Pure business logic. No React, no clock, no randomness.
    money.ts       Integer-pence Money type, input parsing, GBP formatting
    bank.ts        Accounts, deposit / withdraw / select as pure state transitions
    result.ts      Result<T, E> for expected failures
  state/
    bankStore.ts   Small observable store: wires the domain to a clock and ID generator
    ids.ts         Sequential, human-readable IDs (ACC-0001, TXN-000001)
    BankProvider.tsx  React context + useSyncExternalStore binding
  components/      UI, one component per responsibility
    messages.ts    Maps domain error codes to teller-facing copy
  test/            Shared test helpers
  app/             Next.js entry (layout, page, global CSS)
```

The dependency direction is one-way: `components → state → domain`. The domain layer can be lifted out and reused (e.g. on a server) unchanged.

## Design decisions

**Money is integer pence, never floats.** All amounts are in pounds sterling (GBP), shown as `£1,250.00`. `parseAmount("0.29")` is done on the string digits, so it yields exactly 29 pence rather than 28.999… `Cents` (hundredths of a pound) is a branded type so a plain pounds `number` can't be passed where pence are expected by accident. Amounts are capped at £1,000,000 per transaction, which also keeps every value well inside `Number.MAX_SAFE_INTEGER`.

**Expected failures are values, not exceptions.** Overdrafts, blank names and bad amounts come back as `Result` errors with a typed `code` (e.g. `INSUFFICIENT_FUNDS` with `available` and `requested`). Exceptions are kept for programmer errors. Tests assert on codes; wording lives in `components/messages.ts` so copy can change (or be translated) without touching business rules.

**The domain is pure and deterministic.** Every operation takes the current state and returns a new one; nothing is mutated. The current time and ID generator are injected, which is why the tests need no fake timers or mocks. IDs are requested only after validation passes, so a rejected withdrawal doesn't leave a gap in the transaction sequence.

**Validation happens in two places on purpose.** The UI parses input (`parseAmount`) and gives specific feedback; the domain independently enforces its invariants (positive amount, no overdraft, account exists). The domain never trusts its caller.

**State management.** A ~60-line store exposed through `useSyncExternalStore`, rather than `useReducer` or a library. Store methods return their `Result` synchronously, which makes inline error handling in forms straightforward (a reducer can't return a value to its dispatcher), and the store is testable with no React at all. For an app this size, Redux/Zustand would be extra weight without extra capability.

**Sequential IDs over UUIDs.** `ACC-0001` is unique within the session (the only lifetime that exists here) and is something a teller can read out to a customer. The generator is injected, so swapping to `crypto.randomUUID()` is a one-line change.

**UX details.**
- Opening an account selects it, so the teller can take the first deposit straight away.
- The transaction form is keyed by account ID: switching customer clears any half-typed amount, so money can't be entered against the wrong account.
- The amount field only accepts digits, `.`, `,` and `£`; letters are dropped as they're typed or pasted.
- On error the typed amount is kept so the teller can correct it; on success it's cleared and a confirmation is announced.
- History is newest first, with a running balance per row.
- Accessibility: labelled inputs, errors linked via `aria-describedby` and announced with `role="alert"`, confirmations and the balance in polite live regions, `aria-current` on the selected account, visible keyboard focus, and a layout that works down to phone width.

## Branding

The UI follows the Deutsche Bank brand guidelines (3rd edition, July 2019). All brand values are CSS custom properties at the top of `src/app/globals.css`.

- **Colour.** Deutsche Blue (`#0018A8`) is kept for highlighting: headings, the balance, primary actions, the selected account and focus rings. It is always used solid, never tinted. Body text uses the dark supporting blue (PMS 289c) instead of black, and every neutral (page background, rules, muted text) is a tint of that blue rather than a grey, because the guidelines don't allow tints of black. Deposits and withdrawals are told apart by Deutsche Blue versus dark blue plus a +/− sign, so colour is never the only cue. The error red is a functional colour kept for accessibility and is the one colour not taken from the brand palette.
- **Typography.** The stacks name Deutsche Bank Text and Deutsche Bank Display first, so they're used wherever they're installed. Otherwise they fall back to the guideline substitutes: Arial for Text and Calibri Light for Display. Calibri Light is smaller size for size, so `font-size-adjust` normalises it. Display type is tracked no tighter than -40/1000em (the balance uses -20), there's no letter-spacing for effect, and there's no automatic hyphenation.
- **Logo.** Not included. Drop the official asset from the brand portal into the header if needed.

## Testing approach

76 tests across three levels:

| Level | Files | What it covers |
| --- | --- | --- |
| Domain unit | `money.test.ts`, `bank.test.ts` | Parsing edge cases (float traps, commas, precision, limits), every error path, immutability, overdraft boundary (exact balance allowed, +1p rejected) |
| Store | `bankStore.test.ts`, `ids.test.ts` | Subscription/notification, failed ops don't notify or change state, stable snapshots for `useSyncExternalStore` |
| Component / integration | `*.test.tsx` | Driven through Testing Library by role and label only, i.e. what a teller sees: open account, deposit, withdraw, overdraft error, switching accounts, form reset on switch |

Pure-logic tests run in the Node environment; component tests use jsdom.

## Assumptions and things I'd do next

- Currency is GBP (pounds sterling).
- Customer names are trimmed and whitespace-collapsed; duplicate names are allowed because accounts are identified by ID.
- Next steps with more time: Playwright end-to-end smoke test in a real browser, ESLint + Prettier in CI, optional `sessionStorage` persistence (the store's `initialState` parameter is the seam for it), and a confirmation step for very large withdrawals.
