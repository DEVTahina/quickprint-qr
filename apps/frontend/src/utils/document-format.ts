import type { DocumentStatus } from '../types/document';

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  received: 'Reçu',
  printed: 'Imprimé',
  deleted: 'Supprimé',
};

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} o`;
  }

  const kiloBytes = bytes / 1024;

  if (kiloBytes < 1024) {
    return `${kiloBytes.toFixed(0)} Ko`;
  }

  return `${(kiloBytes / 1024).toFixed(1)} Mo`;
}
