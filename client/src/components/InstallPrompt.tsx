import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-dismiss') === '1');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[60] flex items-center gap-3 rounded-xl border border-white/10 bg-surface-card p-4 shadow-xl md:inset-x-auto md:bottom-4 md:right-4">
      <p className="text-sm">Installa l&apos;app sul tuo dispositivo</p>
      <button
        className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white"
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
      >
        Installa
      </button>
      <button
        className="text-sm text-gray-400"
        onClick={() => {
          localStorage.setItem('pwa-dismiss', '1');
          setDismissed(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}
