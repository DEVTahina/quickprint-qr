import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Printer,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ROUTES } from '../../constants/app';
import { previewDocument } from '../../services/api/documents';
import { completePrintBatch } from '../../services/api/print-batches';
import type { PrintJob } from '../../utils/print-pdf';
import { printDocuments } from '../../utils/print-pdf';
import { getApiError } from '../../utils/api-error';

GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

/**
 * Visionneuse PDF.js accessible par URL directe, y compris depuis un
 * telephone. L'impression ouvre la boite de dialogue du navigateur ; le
 * marquage « imprime » reste une confirmation explicite.
 */
export default function DocumentViewerPage() {
  const { id = '' } = useParams<{ id: string }>();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Largeur disponible : la page s'adapte a l'ecran du telephone.
  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Chargement du PDF a partir de l'URL signee de courte duree.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setPdf(null);
    setPageNumber(1);
    setZoom(1);
    setPrintJob(null);

    const task = (async () => {
      if (!id) {
        throw new Error('Document introuvable.');
      }

      const { url } = await previewDocument(id);
      return getDocument({ url });
    })();

    void task
      .then((loadingTask) => loadingTask.promise)
      .then((document) => {
        if (active) {
          setPdf(document);
          setLoading(false);
        } else {
          void document.loadingTask.destroy();
        }
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        const apiError = getApiError(loadError);
        setError(
          apiError.message ??
            "Ce PDF ne peut pas être affiché : fichier introuvable, illisible ou protégé.",
        );
        setLoading(false);
      });

    return () => {
      active = false;
      void task
        .then((loadingTask) => loadingTask.destroy())
        .catch(() => undefined);
    };
  }, [id]);

  useEffect(() => {
    if (!pdf) {
      return;
    }

    void pdf.getMetadata().then((metadata) => {
      const info = metadata.info as { Title?: string } | undefined;
      setFileName(info?.Title?.trim() || '');
    });
  }, [pdf]);

  // Rendu de la page courante au zoom courant.
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!pdf || !canvas || containerWidth <= 0) {
      return;
    }

    let active = true;
    let renderTask: RenderTask | undefined;

    void pdf.getPage(pageNumber).then((page) => {
      if (!active) {
        return;
      }          const base = page.getViewport({ scale: 1 });
      const fitScale = Math.min(containerWidth / base.width, 1.5);
      const viewport = page.getViewport({ scale: fitScale * zoom });
      const context = canvas.getContext('2d');

      if (!context) {
        setError("Le navigateur ne peut pas afficher ce PDF.");
        return;
      }

      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });

      renderTask.promise.catch((renderError: unknown) => {
        const name =
          typeof renderError === 'object' && renderError !== null
            ? (renderError as { name?: string }).name
            : '';
        if (active && name !== 'RenderingCancelledException') {
          setError("La page n'a pas pu être affichée.");
        }
      });
    });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, zoom, containerWidth]);

  const totalPages = pdf?.numPages ?? 0;

  function changeZoom(direction: -1 | 1) {
    setZoom((current) =>
      Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, Math.round((current + direction * ZOOM_STEP) * 100) / 100),
      ),
    );
  }

  async function handlePrint() {
    setPrinting(true);
    setActionError(null);
    setNotice(null);

    try {
      const job = await printDocuments([id]);
      setPrintJob(job);
    } catch (printError: unknown) {
      const { message } = getApiError(printError);
      setActionError(
        message ??
          (printError instanceof Error
            ? printError.message
            : "L'impression n'a pas pu être préparée."),
      );
    } finally {
      setPrinting(false);
    }
  }

  async function finishBatch(markPrinted: boolean) {
    if (!printJob) {
      return;
    }

    setFinishing(true);
    setActionError(null);

    try {
      await completePrintBatch(printJob.batchId, markPrinted);
      setPrintJob(null);
      setNotice(
        markPrinted
          ? 'Document marqué comme imprimé.'
          : 'Lot clôturé, le document reste en attente.',
      );
    } catch (finishError: unknown) {
      const { message } = getApiError(finishError);
      setActionError(
        message ?? "Impossible de finaliser le lot d'impression.",
      );
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="container viewer-page">
      <div className="viewer-toolbar">
        <Link className="btn btn--ghost btn--small" to={ROUTES.adminDocuments}>
          <ArrowLeft size={15} aria-hidden="true" />
          Documents
        </Link>

        <div className="viewer-toolbar__title">
          <strong>{fileName || 'Aperçu du document'}</strong>
          <span>
            {totalPages > 0
              ? `Page ${pageNumber} sur ${totalPages}`
              : 'Chargement…'}
          </span>
        </div>

        <div className="viewer-toolbar__actions">
          <button
            className="btn btn--ghost btn--small"
            type="button"
            title="Zoom arrière"
            aria-label="Zoom arrière"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => changeZoom(-1)}
          >
            <ZoomOut size={15} aria-hidden="true" />
          </button>
          <span className="viewer-zoom">{Math.round(zoom * 100)} %</span>
          <button
            className="btn btn--ghost btn--small"
            type="button"
            title="Zoom avant"
            aria-label="Zoom avant"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => changeZoom(1)}
          >
            <ZoomIn size={15} aria-hidden="true" />
          </button>
          <button
            className="btn btn--ghost btn--small"
            type="button"
            title="Page précédente"
            aria-label="Page précédente"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button
            className="btn btn--ghost btn--small"
            type="button"
            title="Page suivante"
            aria-label="Page suivante"
            disabled={pageNumber >= totalPages}
            onClick={() =>
              setPageNumber((current) => Math.min(totalPages, current + 1))
            }
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          <button
            className="btn btn--primary btn--small"
            type="button"
            disabled={loading || printing || !!error}
            onClick={() => void handlePrint()}
          >
            {printing ? (
              <Loader2 className="spin" size={15} aria-hidden="true" />
            ) : (
              <Printer size={15} aria-hidden="true" />
            )}
            Imprimer
          </button>
        </div>
      </div>

      <p className="viewer-hint">
        L'impression ouvre la boîte de dialogue de votre navigateur. QuickPrint
        QR ne peut pas imprimer silencieusement ni savoir si l'imprimante a
        terminé ; le statut « imprimé » est confirmé par vous après l'opération.
      </p>

      {actionError ? (
        <p className="alert alert--error" role="alert">
          {actionError}
        </p>
      ) : null}

      {notice ? (
        <p className="realtime-notice" role="status">
          {notice}
        </p>
      ) : null}

      {printJob ? (
        <div className="print-confirm" role="status">
          <p>
            La boîte d'impression a été ouverte pour {printJob.totalDocuments}{' '}
            document. Marquer ce document comme imprimé ?
          </p>
          <div className="print-confirm__actions">
            <button
              className="btn btn--primary btn--small"
              type="button"
              disabled={finishing}
              onClick={() => void finishBatch(true)}
            >
              Oui, marquer imprimé
            </button>
            <button
              className="btn btn--ghost btn--small"
              type="button"
              disabled={finishing}
              onClick={() => void finishBatch(false)}
            >
              Non, laisser en attente
            </button>
          </div>
        </div>
      ) : null}

      <div className="viewer-stage" ref={containerRef}>
        {loading ? (
          <div className="viewer-state">
            <Loader2 className="spin" size={22} aria-hidden="true" />
            <span>Chargement du PDF…</span>
          </div>
        ) : error ? (
          <div className="viewer-state viewer-state--error" role="alert">
            <span>{error}</span>
            <Link className="btn btn--ghost btn--small" to={ROUTES.adminDocuments}>
              Retour à la liste
            </Link>
          </div>
        ) : (
          <canvas ref={canvasRef} className="viewer-canvas" />
        )}
      </div>

    </div>
  );
}
