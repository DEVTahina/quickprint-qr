import { PDFDocument } from 'pdf-lib';

import { previewDocument } from '../services/api/documents';
import { createPrintBatch } from '../services/api/print-batches';

export interface PrintJob {
  batchId: string;
  totalDocuments: number;
}

/**
 * Prepare les octets d'un PDF unique, ou fusionne les documents selectionnes
 * dans leur ordre de selection. Le lot n'est cree qu'une fois les octets
 * disponibles : aucune impression impossible n'entre dans l'historique.
 */
async function buildPrintablePdf(ids: string[]): Promise<Uint8Array> {
  const buffers: ArrayBuffer[] = [];

  for (const id of ids) {
    const { url } = await previewDocument(id);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        "Le fichier n'a pas pu être téléchargé. Actualisez la liste puis réessayez.",
      );
    }

    buffers.push(await response.arrayBuffer());
  }

  if (buffers.length === 1) {
    return new Uint8Array(buffers[0] as ArrayBuffer);
  }

  const merged = await PDFDocument.create();

  for (const buffer of buffers) {
    // Certains PDF sont chiffres avec un mot de passe vide (restrictions
    // d'impression) : ils restent fusionnables pour un usage interne.
    const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}

/** Ouvre la boite d'impression du navigateur via un iframe meme origine. */
function openPrintDialog(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');

  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.border = '0';
  frame.style.opacity = '0';

  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      // Laisse le temps a la boite d'impression de lire le document.
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        frame.remove();
      }, 5 * 60_000);
    }
  };

  frame.src = url;
  document.body.appendChild(frame);
}

/**
 * Prepare l'impression de un ou plusieurs documents.
 *
 * Le navigateur affiche sa propre boite de dialogue : l'application ne peut
 * ni imprimer silencieusement, ni savoir si l'imprimante a termine. Le
 * marquage « imprime » reste donc une action explicite separee.
 */
export async function printDocuments(ids: string[]): Promise<PrintJob> {
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    throw new Error('Sélectionnez au moins un document à imprimer.');
  }

  let pdfBytes: Uint8Array;

  try {
    pdfBytes = await buildPrintablePdf(uniqueIds);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Le PDF n'a pas pu être préparé pour l'impression.");
  }

  const batch = await createPrintBatch(uniqueIds);

  openPrintDialog(
    new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }),
  );

  return { batchId: batch.id, totalDocuments: batch.totalDocuments };
}
