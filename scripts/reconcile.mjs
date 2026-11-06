// Reuse the trusted publisher's reconciliation/GC without changing a preview.
process.argv.push('reconcile=true');
await import('./publish.mjs');
