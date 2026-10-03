import { useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import type { ImageItem, ImageSettings } from '../types';
import { formatBytes, getSizeChange } from '../lib/imageProcessing';

interface PreviewDialogProps {
  item: ImageItem;
  settings: ImageSettings;
  onClose: () => void;
  onDownload: (id: string) => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}

export function PreviewDialog({ item, settings, onClose, onDownload, closeButtonRef }: PreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const output = item.output;
  const savings = output ? getSizeChange(item.file.size, output.blob.size) : null;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      restoreFocusRef.current?.focus();
    };
  }, [closeButtonRef]);

  const close = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  };

  const keepFocusInside = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog ref={dialogRef} className="preview-dialog" aria-labelledby="preview-title" onKeyDown={keepFocusInside}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}>
      <div className="preview-header">
        <div className="preview-heading-copy">
          <p className="eyebrow">Image preview</p>
          <h2 id="preview-title" className="preview-title">{item.file.name}</h2>
        </div>
        <button type="button" ref={closeButtonRef} className="preview-close" aria-label="Close preview" onClick={close}>×</button>
      </div>
      <div className="preview-body">
        <div className="preview-comparison">
          <figure className="preview-pane">
            <figcaption>Original <span>{item.width} × {item.height}px</span></figcaption>
            <div className="preview-image-frame preview-checkerboard"><img className="preview-image" src={item.originalUrl} alt={`Original image: ${item.file.name}`} /></div>
            <p className="preview-file-meta">{formatBytes(item.file.size)}</p>
          </figure>
          <figure className="preview-pane">
            <figcaption>Prepared <span>{output ? `${output.width} × ${output.height}px` : 'Not processed yet'}</span></figcaption>
            <div className="preview-image-frame preview-checkerboard">
              {output
                ? <img className="preview-image" src={output.url} alt={`Prepared image: ${output.name}`} />
                : <div className="preview-empty">Process this image to see the result.</div>}
            </div>
            <p className="preview-file-meta">
              {output ? <>{formatBytes(output.blob.size)} · {savings !== null && `${savings >= 0 ? `${savings.toFixed(1)}% smaller` : `${Math.abs(savings).toFixed(1)}% larger`}`}</> : `Output: ${settings.format.replace('image/', '').toUpperCase()}`}
            </p>
          </figure>
        </div>
      </div>
      <div className="preview-actions">
        <button type="button" className="preview-close-secondary" onClick={close}>Close</button>
        <button type="button" className="preview-save" disabled={!output} onClick={() => { if (output) onDownload(item.id); }}>Save image</button>
      </div>
    </dialog>
  );
}

export default PreviewDialog;
