# Local Mihomo E2E Checklist

## Prerequisites

- Mihomo controller is running and reachable.
- Environment variables are set:
  - MIHOMO_BASE_URL
  - MIHOMO_SECRET
- Optional test controls:
  - E2E_GROUP_NAME
  - E2E_TARGET_PROXY
  - E2E_CONFIRM=1 (required for mutation confirms)

## Commands

1. Install dependencies

```bash
npm ci
```

2. Typecheck and unit tests

```bash
npm run typecheck
npm test
```

3. Local E2E dry-run (prepare + preflight only)

```bash
npm run e2e:local
```

4. Local E2E with confirms (mutating)

```bash
E2E_CONFIRM=1 npm run e2e:local
```

5. Verify release gate report

```bash
npm run release:gate
```

## Expected Outcomes

- list tools return success.
- prepare and preflight return tokens.
- confirm is blocked unless E2E_CONFIRM=1.
- get_metrics_snapshot contains executed tools.
- release gate passes only when report has `Result: PASS`.
