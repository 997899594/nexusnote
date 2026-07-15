-- Destructive removal is deliberately deferred. The previous Web runtime can still write
-- cost_cents until the 2026-07-15 runtime release is fully rolled out. A later contract-only
-- release may drop the compatibility column after fleet convergence has been verified.
SELECT 1;
