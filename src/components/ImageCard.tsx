import type { ImageItem, ImageSettings } from '../types';
import { formatBytes, getSizeChange } from '../lib/imageProcessing';

interface ImageCardProps {
  item: ImageItem;
  settings: ImageSettings;
  isBusy: boolean;
  onPreview: (item: ImageItem) => void;
  onRemove: (id: string) => void;
  onDownload: (id: string) => void;
}

function statusLabel(item: ImageItem): string {
  if (item.status === 'processing') return 'Preparing';
  if (item.status === 'error') return 'Needs attention';
  if (item.output) return 'Ready to save';
  return 'Ready to prepare';
}

export function ImageCard({ item, settings, isBusy, onPreview, onRemove, onDownload }: ImageCardProps) {
  const output = item.output;
  const savedPercent = output ? getSizeChange(item.file.size, output.blob.size) : 0;
  const sizeSummary = output
    ? `${formatBytes(item.file.size)} → ${formatBytes(output.blob.size)}`
    : formatBytes(item.file.size);

  return (
    <article className={`image-card${output ? ' is-complete' : ''}${item.status === 'error' ? ' has-error' : ''}`} role="listitem">
      <div className="image-card-main">
        <button type="button" className={`thumbnail-button${output ? ' thumb-ready' : ''}`} aria-label={`Preview ${item.file.name}`}
          onClick={() => onPreview(item)}>
          <img src={output?.url ?? item.originalUrl} alt="" loading="lazy" decoding="async" />
          {output && <span className="thumbnail-check" aria-hidden="true">✓</span>}
        </button>
        <div className="image-card-details">
          <div className="image-title-line">
            <h3 className="image-name-heading"><button type="button" className="image-name" title={item.file.name}
              aria-label={`Preview details for ${item.file.name}`} onClick={() => onPreview(item)}>{item.file.name}</button></h3>
            <span className={`image-status status-${item.status}`}>{statusLabel(item)}</span>
          </div>
          <p className="image-meta">
            <span>{item.width} × {item.height}px</span><span aria-hidden="true">·</span>
            <span>{sizeSummary}</span>
          </p>
          {output && <p className={`size-change${savedPercent < 0 ? ' size-increase' : ''}`}>
            {savedPercent >= 0 ? `${savedPercent.toFixed(1)}% smaller` : `${Math.abs(savedPercent).toFixed(1)}% larger`}
            <span> · {output.width} × {output.height}px · {output.format.replace('image/', '').toUpperCase()}</span>
          </p>}
          {settings.targetBytes !== undefined && output?.targetMet === true && <p className="target-size-result target-within">
            Within target · {settings.targetBytes / 1000} KB requested
          </p>}
          {settings.targetBytes !== undefined && output?.targetMet === false && <p className="target-size-result target-exceeded-note">
            Target exceeded · the lowest quality could not meet this size. Try smaller dimensions.
          </p>}
          {item.error && <p className="image-error" role="alert">{item.error} Try another image or adjust the settings, then prepare it again.</p>}
        </div>
      </div>
      <div className="image-card-actions">
        {output && <button type="button" className="download-button" aria-label={`Download ${output.name}`}
          onClick={() => onDownload(item.id)}>Save image <span aria-hidden="true">↓</span></button>}
        <button type="button" className="remove-button" aria-label={`Remove ${item.file.name}`} disabled={isBusy}
          onClick={() => onRemove(item.id)}>Remove</button>
      </div>
      <span className="visually-hidden">Output format: {settings.format.replace('image/', '').toUpperCase()}</span>
    </article>
  );
}

export default ImageCard;
