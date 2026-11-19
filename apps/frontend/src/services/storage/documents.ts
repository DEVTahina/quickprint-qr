/** Erreur lisible renvoyée par l'upload direct vers Supabase Storage. */
export class PdfUploadError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PdfUploadError';
    this.status = status;
  }
}

const UPLOAD_TIMEOUT_MS = 5 * 60_000;

function readStorageError(xhr: XMLHttpRequest): string {
  try {
    const payload = JSON.parse(xhr.responseText) as {
      message?: string;
      error?: string;
    };
    const message = payload.message ?? payload.error;

    if (message) {
      return message;
    }
  } catch {
    // Le corps n'est pas du JSON : on utilise le message générique.
  }

  if (xhr.status === 413) {
    return 'Le fichier est trop volumineux pour le stockage.';
  }

  if (xhr.status === 415) {
    return 'Le stockage refuse ce format de fichier.';
  }

  if (xhr.status === 403) {
    return "L'autorisation d'envoi a expiré. Recommencez avec ce fichier.";
  }

  return "L'envoi du fichier a échoué. Vérifiez votre connexion et réessayez.";
}

/**
 * Envoi direct du PDF depuis le téléphone vers l'URL signée Supabase.
 * XHR est utilisé ici uniquement pour exposer la progression réelle ; le
 * fichier ne transite jamais par le backend Render.
 */
export function uploadPdfToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (percent: number | null) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', signedUrl, true);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.setRequestHeader('Cache-Control', 'max-age=3600');
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      } else {
        onProgress(null);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new PdfUploadError(readStorageError(xhr), xhr.status));
    });

    xhr.addEventListener('error', () => {
      reject(
        new PdfUploadError(
          'Impossible de joindre le stockage. Vérifiez votre connexion.',
        ),
      );
    });

    xhr.addEventListener('timeout', () => {
      reject(
        new PdfUploadError(
          "L'envoi a pris trop de temps. Vérifiez votre connexion et réessayez.",
        ),
      );
    });

    xhr.addEventListener('abort', () => {
      reject(new PdfUploadError("L'envoi du fichier a été interrompu."));
    });

    xhr.send(file);
  });
}
