import { useState } from 'preact/hooks';
import type { Settings } from '../lib/settings.ts';
import { saveSettings } from '../lib/settings.ts';
import { exportProgress, importProgress, loadProgress } from '../lib/progress.ts';

export function SettingsScreen(p: { settings: Settings; onChange: (s: Settings) => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const set = (patch: Partial<Settings>): void => {
    const next = { ...p.settings, ...patch };
    saveSettings(next);
    p.onChange(next);
  };

  const doExport = async (): Promise<void> => {
    const c = exportProgress(loadProgress());
    setCode(c);
    setError(null);
    try {
      await navigator.clipboard.writeText(c);
      setOkMsg('Progress code copied.');
    } catch {
      setOkMsg('Copy the code below to move devices.');
    }
  };

  const doImport = (): void => {
    try {
      importProgress(code);
      setError(null);
      setOkMsg('Progress restored. Head to the map!');
    } catch (e) {
      setOkMsg(null);
      setError((e as Error).message);
    }
  };

  return (
    <div class="settings">
      <div class="map-head">
        <button class="link-btn" type="button" onClick={p.onBack}>
          ‹ Back
        </button>
        <h1>Settings</h1>
      </div>
      <section class="card" aria-label="Chart">
        <h2>Chart</h2>
        <div class="seg" role="group" aria-label="Chart style">
          <button type="button" class={p.settings.chart === 'candles' ? 'on' : ''} onClick={() => set({ chart: 'candles' })}>
            Candles
          </button>
          <button type="button" class={p.settings.chart === 'line' ? 'on' : ''} onClick={() => set({ chart: 'line' })}>
            Line
          </button>
        </div>
      </section>
      <section class="card" aria-label="Comfort">
        <h2>Comfort</h2>
        <label class="row-toggle">
          <span>Reduce motion</span>
          <input type="checkbox" checked={p.settings.reduceMotion} onChange={(e) => set({ reduceMotion: (e.target as HTMLInputElement).checked })} />
        </label>
        <label class="row-toggle">
          <span>Colour-blind candles (blue/orange)</span>
          <input type="checkbox" checked={p.settings.colorBlind} onChange={(e) => set({ colorBlind: (e.target as HTMLInputElement).checked })} />
        </label>
      </section>
      <section class="card" aria-label="Move progress">
        <h2>Move progress</h2>
        <p class="dim">No accounts. Copy this code to another device to take your stars.</p>
        <div class="result-row">
          <button class="btn btn-secondary" type="button" onClick={() => void doExport()}>
            Export my progress
          </button>
        </div>
        <label class="dim" for="wick-import">
          Paste a progress code:
        </label>
        <textarea id="wick-import" class="import-box mono" rows={3} value={code} onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} spellcheck={false} />
        {error && (
          <p class="form-error" role="alert">
            {error}
          </p>
        )}
        {okMsg && (
          <p class="form-ok" role="status">
            {okMsg}
          </p>
        )}
        <div class="result-row">
          <button class="btn btn-primary" type="button" onClick={doImport}>
            Import
          </button>
        </div>
      </section>
    </div>
  );
}
