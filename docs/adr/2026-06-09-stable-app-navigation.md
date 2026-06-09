# ADR: Stable App Navigation

Date: 2026-06-09

## Status

Accepted

## Context

NexusNote has several app surfaces that are entered from conversational or generated
intermediate states: course interview, generated learning pages, public course saving,
note editing, career planning, and profile analysis. A browser-history return action can
send users back into one-time states such as interview or save flows, which makes the app
feel inconsistent and fragile.

The product needs a unified navigation language:

- primary hubs are stable destinations, not transient history entries
- return controls use the same visual treatment and labels
- route transitions that complete an intermediate flow replace history when needed
- pages declare their parent destination in code instead of hardcoding ad hoc links

## Decision

Use explicit stable navigation targets for app-level return behavior.

- Stable targets live in `lib/navigation/app-navigation.ts`.
- Page-level return destinations live in `PAGE_BACK_TARGETS`.
- Shared return UI uses `AppBackLink`.
- `FloatingHeader` and `MobileHeader` accept stable `backHref` values and do not call
  `router.back()` by default.
- Intermediate completion transitions use `router.replace()` or
  `window.location.replace()` when returning to the intermediate page would be wrong.

Current parent mapping:

| Page surface | Stable parent |
| --- | --- |
| Chat | Home |
| Course interview | Home |
| Learning page | Profile |
| Public course reader | Home |
| Career trees | Profile |
| Knowledge workbench | Profile |
| Note editor detail | Knowledge workbench |
| Profile insights | Profile |
| Profile settings | Profile |

## Consequences

This makes return behavior deterministic across refreshes, direct links, login redirects,
course creation, and public-course save flows. It also removes the need for each page to
invent its own return copy, icon size, and destination.

New app pages should add a `PAGE_BACK_TARGETS` entry before adding a visible return control.
`router.back()` should be reserved for local modal or drawer state where the browser history
entry was intentionally created for that local interaction.
