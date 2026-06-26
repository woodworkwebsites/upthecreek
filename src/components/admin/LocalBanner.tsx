export function LocalBanner() {
  return (
    <div className="bg-amber-400 text-amber-950 px-4 py-2 text-center text-xs font-semibold tracking-widest uppercase">
      ⚠ Local Environment — Dry Run Mode — No real orders will be created
    </div>
  );
}

export function DryRunBanner({ mode }: { mode: string }) {
  if (mode === 'live') return null;

  return (
    <div className={`px-4 py-2 text-center text-xs font-semibold tracking-widest uppercase ${
      mode === 'dry_run'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    }`}>
      {mode === 'dry_run' ? '🧪 Dry Run Mode' : '📝 Draft Mode'} — No real production orders
    </div>
  );
}
