# NexusNote Service Level Objectives

Date: 2026-07-14

These objectives define whether the product is operationally healthy. They are release criteria,
not aspirational dashboard labels.

## User-facing objectives

| Signal | Objective | Measurement window |
| --- | ---: | --- |
| Web and learning availability | 99.9% | rolling 30 days |
| Basic chat successful response | 99.5% | rolling 7 days |
| Basic chat time to first token p95 | <= 4 seconds | rolling 24 hours |
| Research workflow terminal result p95 | <= 120 seconds | rolling 24 hours |
| Course section materialization p95 | <= 90 seconds | rolling 24 hours |

Basic chat cost pressure may change model tier and context depth. It must never reject a request or
require entitlement solely because a daily cost threshold was crossed.

## Data and worker objectives

| Signal | Objective | Failure action |
| --- | ---: | --- |
| Critical outbox delivery p95 | <= 60 seconds | investigate worker/provider latency |
| Oldest critical pending event | <= 120 seconds | system health fails |
| Critical dead-letter count | 0 | system health fails and operator replay is required |
| Queue worker heartbeat age | <= 60 seconds | system health fails |
| Database recovery point | <= 5 minutes | restore from managed backups/WAL |
| Database recovery time | <= 30 minutes | invoke recovery runbook |

Product analytics mirror failures are visible but do not fail product health. Learning evidence and
career-tree delivery are critical and do fail health after the thresholds above.

## Operator commands

```bash
bun run learning:funnel 90
bun run outbox:replay <event-uuid>
```

The replay command only resets lifecycle fields. It does not edit the immutable event payload.
