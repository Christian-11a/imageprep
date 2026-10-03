import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, Check, ImagePlus, LockKeyhole, ShieldCheck,
  Sparkles, Upload, X,
} from 'lucide-react';
import { LIMITS, type ImageItem, type ImageSettings } from './types';
import { useImageBatch } from './hooks/useImageBatch';
import { useReveal } from './hooks/useReveal';
import { SettingsPanel } from './components/SettingsPanel';
import { ImageCard } from './components/ImageCard';
import { PreviewDialog } from './components/PreviewDialog';
import coastScene from './assets/scene-coast.svg';
import desertScene from './assets/scene-desert.svg';
import alpineScene from './assets/scene-alpine.svg';

const scenes = [
  { src: coastScene, name: 'coastline.jpg', from: 'JPG', to: 'WEBP', className: 'scene-coast' },
  { src: desertScene, name: 'open-road.jpg', from: 'JPG', to: 'WEBP', className: 'scene-desert' },
  { src: alpineScene, name: 'high-country.jpg', from: 'JPG', to: 'WEBP', className: 'scene-alpine' },
];

function App() {
  const batch = useImageBatch();
  const { items, settings, setSettings, isAdding, isProcessing, isZipping, progress, notice, noticeKind } = batch;
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImageItem | null>(null);
  const [widthDraft, setWidthDraft] = useState(String(settings.maxWidth));
  const [heightDraft, setHeightDraft] = useState(String(settings.maxHeight));
  const [dimensionTouched, setDimensionTouched] = useState({ width: false, height: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const closePreviewRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useReveal(mainRef);

  useEffect(() => {
    setWidthDraft(String(settings.maxWidth));
  }, [settings.maxWidth]);
  useEffect(() => {
    setHeightDraft(String(settings.maxHeight));
  }, [settings.maxHeight]);

  const readyCount = items.filter((item) => item.status === 'ready' || item.status === 'error').length;
  const doneCount = items.filter((item) => item.status === 'done' && item.output).length;
  const hasReady = items.some((item) => item.status === 'ready');
  const hasErrors = items.some((item) => item.status === 'error');
  const widthValue = Number(widthDraft);
  const heightValue = Number(heightDraft);
  const widthValid = Number.isInteger(widthValue) && widthValue > 0 && widthValue <= LIMITS.maxOutputDimension;
  const heightValid = Number.isInteger(heightValue) && heightValue > 0 && heightValue <= LIMITS.maxOutputDimension;
  const dimensionsValid = widthValid && heightValid;
  const estimatedDimensions = useMemo(() => {
    const item = items.find((candidate) => candidate.status === 'ready') ?? items[0];
    if (!item || !dimensionsValid) return null;
    const scale = Math.min(widthValue / item.width, heightValue / item.height, 1);
    return { width: Math.max(1, Math.round(item.width * scale)), height: Math.max(1, Math.round(item.height * scale)) };
  }, [items, dimensionsValid, widthValue, heightValue]);

  function updateSettings(patch: Partial<ImageSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function changeDimension(axis: 'width' | 'height', value: string) {
    setDimensionTouched(current => ({ ...current, [axis]: false }));
    if (axis === 'width') setWidthDraft(value);
    else setHeightDraft(value);
  }

  function commitDimension(axis: 'width' | 'height') {
    setDimensionTouched(current => ({ ...current, [axis]: true }));
    const numeric = Number(axis === 'width' ? widthDraft : heightDraft);
    if (Number.isInteger(numeric) && numeric > 0 && numeric <= LIMITS.maxOutputDimension) {
      updateSettings(axis === 'width' ? { maxWidth: numeric } : { maxHeight: numeric });
    }
  }

  function handleFiles(fileList: FileList | File[]) {
    batch.addFiles(Array.from(fileList));
    if (inputRef.current) inputRef.current.value = '';
  }

  function openPreview(item: ImageItem) { setPreview(item); }

  async function trySample() {
    await batch.addSample();
    workspaceRef.current?.scrollIntoView({ block: 'start' });
  }

  const canProcess = (hasReady || hasErrors) && dimensionsValid && !isProcessing && !isAdding && !isZipping;
  const controlsLocked = isProcessing || isAdding || isZipping;
  const activePreview = preview ? items.find((item) => item.id === preview.id) || null : null;
  useEffect(() => {
    if (preview && !items.some((item) => item.id === preview.id)) setPreview(null);
  }, [items, preview]);

  const processLabel = isProcessing
    ? `Preparing ${progress.completed} of ${progress.total}…`
    : doneCount > 0 && !hasReady && !hasErrors ? 'All images prepared'
      : doneCount > 0 && hasReady ? 'Prepare remaining' : 'Prepare images';

  return (
    <div className="app-shell" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ImagePrep home">
          <span className="brand-mark"><ImagePlus size={18} strokeWidth={2.1} /></span>
          <span>ImagePrep</span>
        </a>
        <nav className="topbar-nav" aria-label="Main navigation">
          <a href="#workspace">Tool</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <a className="topbar-cta" href="#workspace">Get started <ArrowRight size={15} /></a>
      </header>

      <main className="main-content" ref={mainRef}>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <h1 id="page-title" aria-label="Small files. Big possibilities.">Small files.<br /><em>Big possibilities.</em></h1>
            <p className="intro-copy">Resize and convert your images in a few clicks. Everything happens right here on your device.</p>
            <div className="hero-actions">
              <a className="button button-primary hero-primary" href="#workspace">Start preparing <ArrowRight size={17} /></a>
              <button className="sample-link" onClick={trySample} disabled={controlsLocked}><span className="sample-mark"><Sparkles size={14} /></span>Try a sample image</button>
            </div>
            <div className="hero-trust"><span><LockKeyhole size={13} /> Files stay on your device</span><i /> <span>Free to use</span><i /> <span>No account needed</span></div>
          </div>
          <div className="hero-showcase" aria-label="A few images, ready for wherever they need to go">
            <div className="showcase-note"><span className="showcase-kicker">A little more room to roam</span><span className="showcase-caption">JPG <ArrowRight size={12} /> WEBP</span></div>
            {scenes.map((scene, index) => <div className={`scene-card ${scene.className}`} key={scene.name}>
              <img src={scene.src} alt="" />
              <div className="scene-card-caption"><span>{scene.name}</span><span>{scene.from}<ArrowRight size={11} />{scene.to}</span></div>
              {index === 1 && <span className="scene-sticker"><Check size={13} /> Ready for wherever</span>}
            </div>)}
            <span className="showcase-orbit" aria-hidden="true" />
          </div>
        </section>

        <section className={`dropzone ${dragging ? 'is-dragging' : ''} ${items.length ? 'dropzone-compact' : ''}`}
          id="workspace"
          ref={workspaceRef}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer.files); }}
          aria-label="Upload images">
          <input ref={inputRef} className="visually-hidden" aria-label="Add image files" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={controlsLocked} tabIndex={-1}
            onChange={(event) => event.currentTarget.files && handleFiles(event.currentTarget.files)} />
          <div className="drop-icon"><Upload size={21} /></div>
          <div className="drop-copy">
            <h2>{items.length ? 'Add a few more images' : 'Bring your images in'}</h2>
            <p>Drop them here or choose from your device</p>
            <span className="format-note" id="file-guidance">JPG/JPEG · PNG · still WebP <i /> Up to 10 files · 10 MB and 20 megapixels each</span>
          </div>
          <button className="button button-outline" aria-describedby="file-guidance" onClick={() => inputRef.current?.click()} disabled={controlsLocked}>
            {isAdding ? <><span className="spinner" /> Adding…</> : 'Choose images'}
          </button>
        </section>
        <details className="supported-details"><summary>Supported files and limits</summary><p>Choose JPG/JPEG, PNG, or still WebP images, up to 10 MB and 20 megapixels each. Each batch can contain up to 50 MB and 40 megapixels in total to help manage device memory. HEIC/HEIF, GIF, SVG, PDF, animated PNG, and animated WebP are not supported. Export a still JPG or PNG from your photo app first. Output dimensions are capped at 4096px; images keep their proportions and are never enlarged.</p></details>

        {notice && <div className={`notice notice-${noticeKind}`} role="status">
          <span className="notice-symbol">{noticeKind === 'success' ? <Check size={14} aria-hidden="true" /> : '!'}</span>
          <span>{notice}</span>
          <button aria-label="Dismiss notice" onClick={batch.clearNotice}><X size={16} /></button>
        </div>}
        {batch.canUndoClear && <div className="undo-notice" role="status"><span>Images cleared. Undo is available for 15 seconds.</span><button type="button" onClick={batch.undoClear}>Undo clear</button></div>}
        {batch.rejections.length > 0 && <section className="upload-rejections" aria-labelledby="rejections-title">
          <div className="rejections-heading"><h2 id="rejections-title">{batch.rejections.length} {batch.rejections.length === 1 ? 'file was' : 'files were'} not added</h2><button type="button" aria-label="Dismiss rejected files" onClick={batch.dismissRejections}><X size={16} /></button></div>
          <dl>{batch.rejections.map((file, index) => <div className="rejection-file" key={`${file.name}-${index}`}><dt>{file.name}</dt><dd><p>{file.reason}</p><p className="recovery-hint">{file.recovery}</p></dd></div>)}</dl>
          <p className="recovery-hint">Accepted images stay in your batch. You can choose replacement files above.</p>
        </section>}

        <div className="workbench">
          <section className="image-workspace" aria-label="Your images" data-reveal>
            <div className="workspace-heading">
              <div><h2>{items.length ? 'Your images' : 'Start with one image'}</h2></div>
              {items.length > 0 && <div className="workspace-actions"><span className="count-pill">{items.length} / {LIMITS.maxFiles}</span><button className="text-button" onClick={batch.clearAll} disabled={controlsLocked}>Clear all <X size={14} /></button></div>}
            </div>
            {items.length === 0 ? <div className="empty-state">
              <div className="empty-art" aria-hidden="true"><span className="empty-image empty-image-back" /><span className="empty-image empty-image-front"><i /><b /></span><span className="empty-spark">✳</span></div>
              <h3>A good place to begin.</h3><p>Add a photo and choose a size and format that suit its next stop.</p>
            </div> : <>
              <div className="image-list" role="list" aria-label="Uploaded images">
                {items.map((item) => <ImageCard key={item.id} item={item} settings={settings} isBusy={controlsLocked} onPreview={() => openPreview(item)} onRemove={() => batch.removeItem(item.id)} onDownload={() => batch.downloadItem(item.id)} />)}
              </div>
              <div className="list-footer">
                <span>{items.length} {items.length === 1 ? 'image' : 'images'} <i /> {doneCount ? `${doneCount} ready to download` : `${readyCount} waiting to prepare`}</span>
                {doneCount > 0 && <button className="button button-primary download-all" aria-label="Download all" onClick={batch.downloadAll} disabled={controlsLocked}><ArrowDownToLine size={16} /> {isZipping ? 'Bundling…' : 'Download all'}</button>}
              </div>
            </>}
          </section>

          <div data-reveal>
          <SettingsPanel
            settings={settings}
            onChange={updateSettings}
            controlsLocked={controlsLocked}
            canProcess={canProcess}
            isProcessing={isProcessing}
            progress={progress}
            processLabel={processLabel}
            onProcess={batch.processAll}
            onCancel={batch.cancelProcessing}
            widthValid={widthValid}
            heightValid={heightValid}
            widthError={dimensionTouched.width && !widthValid}
            heightError={dimensionTouched.height && !heightValid}
            widthDraft={widthDraft}
            heightDraft={heightDraft}
            onDimensionChange={changeDimension}
            onDimensionBlur={commitDimension}
            settingsChanged={batch.settingsChanged}
            currentFilename={items.find(item => item.status === 'processing')?.file.name}
            estimatedDimensions={estimatedDimensions}
          />
          </div>
        </div>
        {items.length > 0 && <div className="mobile-actions"><span>{isProcessing ? `Preparing ${progress.completed} of ${progress.total}` : doneCount && !readyCount ? `${doneCount} ready to save` : `${readyCount} waiting to prepare`}</span>
          {isProcessing ? <button type="button" onClick={batch.cancelProcessing}>Cancel preparation</button> : doneCount && !readyCount ? <button type="button" onClick={batch.downloadAll} disabled={controlsLocked} aria-label="Download batch ZIP">{isZipping ? 'Bundling…' : 'Save ZIP'}</button> : <a href="#settings-title">Choose settings <ArrowRight size={14} /></a>}
        </div>}

        <section className="how-section" id="how-it-works" aria-labelledby="how-title" data-reveal>
          <div className="section-intro" data-reveal><h2 id="how-title">From camera roll to ready.</h2></div>
          <div className="how-steps">
            <article className="how-step" data-reveal><span className="step-number">01</span><div><h3>Add a few images</h3><p>Drop in JPG, PNG or WebP files. Your originals stay put.</p></div><Upload size={19} /></article>
            <article className="how-step" data-reveal><span className="step-number">02</span><div><h3>Choose the details</h3><p>Set a maximum size, format and quality for the batch.</p></div><ImagePlus size={19} /></article>
            <article className="how-step" data-reveal><span className="step-number">03</span><div><h3>Check, then save</h3><p>Preview each result and download the files you need.</p></div><ArrowDownToLine size={19} /></article>
          </div>
        </section>

        <section className="privacy-section" id="privacy" data-reveal>
          <div className="privacy-icon"><ShieldCheck size={21} /></div>
          <div><h2>Private from the first click.</h2><p>ImagePrep works in your browser. Your image files are never sent to a server, and there’s no account to create.</p></div>
          <div className="privacy-detail"><span><LockKeyhole size={15} /> Local processing</span><span>Up to 10 images</span><span>Up to 10 MB per image</span></div>
        </section>
        <section className="notes-section" aria-label="Helpful details">
          <details className="faq-detail"><summary>Are there image size or metadata limits?</summary><p>Each image can be up to 10 MB and 20 megapixels. Re-exporting may remove metadata such as location and camera details.</p></details>
          <details className="faq-detail"><summary>What should I know about the results?</summary><p>Images are never enlarged. PNG is lossless and can be larger after export. Colors may look slightly different after conversion, so preview before using the file.</p></details>
        </section>
        <footer className="page-footer"><a className="brand footer-brand" href="#top"><span className="brand-mark"><ImagePlus size={16} /></span><span>ImagePrep</span></a><span>Made for wherever your images need to go.</span><a href="#top">Back to top ↑</a></footer>
      </main>

      {activePreview && <PreviewDialog item={activePreview} settings={settings} onClose={() => setPreview(null)} onDownload={() => batch.downloadItem(activePreview.id)} closeButtonRef={closePreviewRef} />}
    </div>
  );
}

export default App;
