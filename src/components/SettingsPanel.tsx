import { useEffect, useState } from 'react';
import { LIMITS, type ImageSettings } from '../types';

interface SettingsPanelProps {
  settings: ImageSettings;
  onChange: (patch: Partial<ImageSettings>) => void;
  controlsLocked: boolean;
  canProcess: boolean;
  isProcessing: boolean;
  progress: { completed: number; total: number };
  processLabel: string;
  onProcess: () => void;
  onCancel: () => void;
  widthValid: boolean;
  heightValid: boolean;
  widthError?: string | boolean;
  heightError?: string | boolean;
  widthDraft: string;
  heightDraft: string;
  onDimensionChange: (axis: 'width' | 'height', value: string) => void;
  onDimensionBlur: (axis: 'width' | 'height') => void;
  estimatedDimensions: { width: number; height: number } | null;
  currentFilename?: string;
  settingsChanged: boolean;
}

const FORMATS = {
  'image/webp': 'WebP is a compact modern format with broad browser support.',
  'image/jpeg': 'JPEG is widely supported. Transparent areas use the selected background color.',
  'image/png': 'PNG preserves transparency. Quality is not adjustable for this format.',
} as const;
const DEFAULT_TARGET_KB = 500;
const MAX_TARGET_KB = 10_000;

export function SettingsPanel({
  settings, onChange, controlsLocked, canProcess, isProcessing, progress, processLabel,
  onProcess, onCancel, widthValid, heightValid, widthError, heightError, widthDraft, heightDraft,
  onDimensionChange, onDimensionBlur, estimatedDimensions, currentFilename, settingsChanged,
}: SettingsPanelProps) {
  const [targetEnabled, setTargetEnabled] = useState(settings.targetBytes !== undefined);
  const [targetDraft, setTargetDraft] = useState(settings.targetBytes === undefined
    ? String(DEFAULT_TARGET_KB)
    : String(Math.max(1, Math.round(settings.targetBytes / 1000))));
  const [targetTouched, setTargetTouched] = useState(false);

  useEffect(() => {
    if (settings.targetBytes === undefined) {
      setTargetEnabled(false);
      setTargetDraft(String(DEFAULT_TARGET_KB));
    } else {
      setTargetEnabled(true);
      setTargetDraft(String(Math.max(1, Math.round(settings.targetBytes / 1000))));
    }
  }, [settings.targetBytes]);

  const setPreset = (size: number) => {
    onDimensionChange('width', String(size));
    onDimensionChange('height', String(size));
    onChange({ maxWidth: size, maxHeight: size });
  };
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0;
  const targetKB = Number(targetDraft);
  const targetDraftValid = targetDraft.trim() !== '' && Number.isInteger(targetKB) && targetKB > 0 && targetKB <= MAX_TARGET_KB;
  const targetValid = !targetEnabled || targetDraftValid;
  const targetError = targetTouched && targetEnabled && !targetValid ? 'Enter a whole number from 1 to 10000 KB.' : '';
  const shownWidthError = widthError ? (typeof widthError === 'string' ? widthError : `Enter a whole number from 1 to ${LIMITS.maxOutputDimension}.`) : '';
  const shownHeightError = heightError ? (typeof heightError === 'string' ? heightError : `Enter a whole number from 1 to ${LIMITS.maxOutputDimension}.`) : '';
  const canSubmit = canProcess && widthValid && heightValid && targetValid && !controlsLocked;

  function commitTargetSize() {
    setTargetTouched(true);
    if (targetEnabled && targetValid) onChange({ targetBytes: targetKB * 1000 });
  }

  function toggleTarget(enabled: boolean) {
    setTargetEnabled(enabled);
    if (!enabled) {
      onChange({ targetBytes: undefined });
      return;
    }
    const value = targetDraftValid ? targetKB : DEFAULT_TARGET_KB;
    if (!targetDraftValid) setTargetDraft(String(DEFAULT_TARGET_KB));
    onChange({ targetBytes: value * 1000 });
  }

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="panel-heading">
        <h2 id="settings-title">Make it fit.</h2>
        <p className="settings-hint">Your original files stay on your device.</p>
      </div>

      <div className="settings-control format-control">
        <label htmlFor="output-format">Output format</label>
        <select id="output-format" className="format-select" value={settings.format} disabled={controlsLocked}
          onChange={(event) => {
            const format = event.target.value as ImageSettings['format'];
            if (format === 'image/png') setTargetEnabled(false);
            onChange(format === 'image/png' ? { format, targetBytes: undefined } : { format });
          }}>
          <option value="image/webp">WebP</option>
          <option value="image/jpeg">JPEG</option>
          <option value="image/png">PNG</option>
        </select>
        <p className="format-help" aria-live="polite">{FORMATS[settings.format]}</p>
      </div>

      <div className="settings-control size-control">
        <div className="control-label-row">
          <span className="control-label">Maximum dimensions</span>
          <span className="control-note">No upscaling · {LIMITS.maxOutputDimension}px cap</span>
        </div>
        <div className="size-presets" role="group" aria-label="Dimension presets">
          {[{ size: 4096, label: 'Largest' }, { size: 1920, label: 'Web' }, { size: 1200, label: 'Compact' }].map(({ size, label }) => (
            <button key={size} type="button" className="preset-button" disabled={controlsLocked}
              aria-pressed={settings.maxWidth === size && settings.maxHeight === size} onClick={() => setPreset(size)}>
              <span>{label}</span><small>{size}px</small>
            </button>
          ))}
        </div>
        <div className="dimension-grid">
          <div className="dimension-field">
            <label htmlFor="max-width">Max width</label>
            <div className="dimension-input-wrap">
              <input id="max-width" inputMode="numeric" type="number" min="1" max={LIMITS.maxOutputDimension}
                step="1" value={widthDraft} disabled={controlsLocked} aria-invalid={Boolean(shownWidthError)}
                aria-describedby={shownWidthError ? 'width-error' : undefined}
                onChange={(event) => onDimensionChange('width', event.target.value)} onBlur={() => onDimensionBlur('width')} />
              <span>px</span>
            </div>
            {shownWidthError && <p className="field-error" id="width-error">{shownWidthError}</p>}
          </div>
          <div className="dimension-field">
            <label htmlFor="max-height">Max height</label>
            <div className="dimension-input-wrap">
              <input id="max-height" inputMode="numeric" type="number" min="1" max={LIMITS.maxOutputDimension}
                step="1" value={heightDraft} disabled={controlsLocked} aria-invalid={Boolean(shownHeightError)}
                aria-describedby={shownHeightError ? 'height-error' : undefined}
                onChange={(event) => onDimensionChange('height', event.target.value)} onBlur={() => onDimensionBlur('height')} />
              <span>px</span>
            </div>
            {shownHeightError && <p className="field-error" id="height-error">{shownHeightError}</p>}
          </div>
        </div>
        <p className="dimension-estimate">
          {estimatedDimensions
            ? <>Preview size: <strong>{estimatedDimensions.width} × {estimatedDimensions.height}px</strong></>
            : 'Add an image to see its output dimensions.'}
        </p>
      </div>

      <div className={`settings-control quality-control${settings.format === 'image/png' ? ' quality-unavailable' : ''}`}>
        <div className="control-label-row">
          <label htmlFor="image-quality">Quality</label>
          <span className="quality-value">{Math.round(settings.quality * 100)}%</span>
        </div>
        <input id="image-quality" type="range" min="0.1" max="1" step="0.05" value={settings.quality}
          disabled={controlsLocked || settings.format === 'image/png'} aria-describedby={settings.format === 'image/png' ? 'quality-help' : undefined}
          onChange={(event) => onChange({ quality: Number(event.target.value) })} />
        {settings.format === 'image/png' && <p className="format-help" id="quality-help">PNG preserves image quality without a quality adjustment.</p>}
      </div>

      {settings.format === 'image/jpeg' && (
        <div className="settings-control background-control">
          <label htmlFor="jpeg-background">Transparent area</label>
          <div className="background-input-wrap">
            <input id="jpeg-background" type="color" value={settings.background} disabled={controlsLocked}
              onChange={(event) => onChange({ background: event.target.value })} />
            <span>{settings.background.toUpperCase()}</span>
          </div>
        </div>
      )}

      <div className={`settings-control target-size-control${settings.format === 'image/png' ? ' target-size-unavailable' : ''}`}>
        <label className="target-size-toggle target-checkbox">
          <input type="checkbox" checked={targetEnabled} disabled={controlsLocked || settings.format === 'image/png'}
            aria-describedby="target-size-help" onChange={(event) => toggleTarget(event.target.checked)} />
          <span>Try to stay under a file size</span>
        </label>
        {settings.format === 'image/png' ? (
          <p className="format-help target-help" id="target-size-help">PNG output size cannot be reliably controlled. Choose JPEG or WebP to set a size target.</p>
        ) : (
          <>
            <p className="format-help target-help" id="target-size-help">We may lower quality down to 10% to try to meet your target. The quality slider sets the maximum. Dimensions stay unchanged; preview the result before saving. Size targets use 1000 bytes per KB.</p>
            {targetEnabled && <div className="target-size-field">
              <label htmlFor="target-size-kb">Target file size</label>
              <div className="dimension-input-wrap">
                <input id="target-size-kb" className="target-input" type="number" min="1" max={MAX_TARGET_KB} step="1" inputMode="numeric" value={targetDraft}
                  disabled={controlsLocked} aria-invalid={Boolean(targetError)}
                  aria-describedby={targetError ? 'target-size-error' : 'target-size-help'}
                  onChange={(event) => { setTargetTouched(false); setTargetDraft(event.target.value); }} onBlur={commitTargetSize} />
                <span>KB</span>
              </div>
              {targetError && <p className="field-error" id="target-size-error">{targetError}</p>}
            </div>}
          </>
        )}
      </div>

      <div className="settings-actions">
        {isProcessing ? (
          <>
            <div className="process-progress">
              <div className="progress-label"><span>Preparing {currentFilename ? <span className="current-file">{currentFilename}</span> : 'images'}</span><span>{progress.completed} of {progress.total}</span></div>
              <div className="progress-track" role="progressbar" aria-label="Image preparation progress"
                aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed} aria-valuetext={`${percent}%`}>
                <span className="progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
              </div>
            </div>
            <button type="button" className="cancel-button" aria-label="Cancel preparation" onClick={onCancel}>Cancel</button>
          </>
        ) : (
          <button type="button" className="process-button" disabled={!canSubmit} onClick={onProcess}>
            <span>{processLabel}</span><span aria-hidden="true">↗</span>
          </button>
        )}
      </div>
      {settingsChanged && !isProcessing && <p className="settings-hint settings-update-hint">
        Settings changed. Prepare again{currentFilename ? <> to update <strong className="current-file">{currentFilename}</strong></> : ' to update your outputs'}.
      </p>}
    </section>
  );
}

export default SettingsPanel;
