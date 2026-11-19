import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  LoaderCircle,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { APP_NAME, ROUTES } from '../../constants/app';
import {
  authorizeUpload,
  finalizeUpload,
  getPublicSession,
} from '../../services/api/sessions';
import {
  PdfUploadError,
  uploadPdfToSignedUrl,
} from '../../services/storage/documents';
import type { PublicPrintSession } from '../../types/session';
import { getApiError } from '../../utils/api-error';

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type UploadStatus =
  | 'pending'
  | 'authorizing'
  | 'uploading'
  | 'finalizing'
  | 'success'
  | 'error';

interface DepositFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number | null;
  error: string | null;
  localInvalid: boolean;
}

let fileSequence = 0;

function nextFileId(): string {
  fileSequence += 1;
  return `pdf-${Date.now()}-${fileSequence}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} o`;
  }

  const units = ['Ko', 'Mo', 'Go'];
  let value = bytes / 1_024;
  let unitIndex = 0;

  while (value >= 1_024 && unitIndex < units.length - 1) {
    value /= 1_024;
    unitIndex += 1;
  }

  return `${value.toFixed(1).replace('.0', '').replace('.', ',')} ${units[unitIndex]}`;
}

function fileCountLabel(count: number): string {
  return `${count} fichier${count > 1 ? 's' : ''}`;
}

function validateFile(file: File, maxFileSizeBytes: number): string | null {
  if (!/\.pdf$/i.test(file.name)) {
    return 'Seuls les fichiers PDF sont acceptés.';
  }

  if (file.size === 0) {
    return 'Ce fichier est vide.';
  }

  if (file.size > maxFileSizeBytes) {
    return `Ce fichier dépasse la limite de ${formatBytes(maxFileSizeBytes)}.`;
  }

  return null;
}

function describeUploadError(error: unknown): string {
  if (error instanceof PdfUploadError) {
    return error.message;
  }

  const { status, message } = getApiError(error);

  if (status === 413) {
    return 'Ce fichier dépasse la taille maximale autorisée.';
  }

  if (status === 415) {
    return 'Ce fichier ne correspond pas à un PDF valide.';
  }

  if (status === 429) {
    return 'Trop de tentatives. Patientez une minute puis réessayez.';
  }

  if (status === 404) {
    return 'Session ou envoi introuvable. Rechargez la page avec le QR Code.';
  }

  if (status) {
    return message ?? "L'envoi a échoué. Réessayez.";
  }

  return 'La connexion a été interrompue. Vérifiez votre réseau et réessayez.';
}

function statusLabel(entry: DepositFile): string {
  switch (entry.status) {
    case 'authorizing':
      return 'Préparation';
    case 'uploading':
      return entry.progress === null ? 'Envoi' : `${entry.progress} %`;
    case 'finalizing':
      return 'Vérification';
    case 'success':
      return 'Envoyé';
    case 'error':
      return 'Échec';
    default:
      return 'Prêt';
  }
}

/** Page publique ouverte apres le scan du QR Code. */
export default function DepositPage() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<PublicPrintSession | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(
    token ? null : 'Lien de session invalide.',
  );
  const [files, setFiles] = useState<DepositFile[]>([]);
  const [sending, setSending] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!token) {
      return;
    }

    void getPublicSession(token)
      .then((data) => {
        if (active) {
          setSession(data);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }

        const { status, message } = getApiError(requestError);
        setError(
          status === 404
            ? 'Ce lien ne correspond à aucune session. Vérifiez le QR Code.'
            : (message ??
              'Impossible de vérifier la session. Vérifiez votre connexion.'),
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  function updateFile(id: string, patch: Partial<DepositFile>) {
    setFiles((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const incoming = Array.from(input.files ?? []);
    input.value = '';

    if (!session || incoming.length === 0) {
      return;
    }

    setGlobalError(null);
    setCompletion(null);

    const selectedCount = files.filter((entry) => !entry.localInvalid).length;
    const remaining = Math.max(0, session.maxFiles - selectedCount);

    if (remaining === 0) {
      setGlobalError(
        `Vous avez déjà sélectionné ${fileCountLabel(session.maxFiles)}, la limite de cette session.`,
      );
      return;
    }

    const selected = incoming.slice(0, remaining);

    if (incoming.length > remaining) {
      setGlobalError(
        `Seuls ${fileCountLabel(remaining)} ont été ajoutés pour respecter la limite de ${session.maxFiles}.`,
      );
    }

    setFiles((current) => [
      ...current,
      ...selected.map((file): DepositFile => {
        const validationError = validateFile(
          file,
          session.maxFileSizeBytes,
        );

        return {
          id: nextFileId(),
          file,
          status: validationError ? 'error' : 'pending',
          progress: null,
          error: validationError,
          localInvalid: Boolean(validationError),
        };
      }),
    ]);
  }

  function removeFile(id: string) {
    if (sending) {
      return;
    }

    setFiles((current) => current.filter((entry) => entry.id !== id));
    setGlobalError(null);
    setCompletion(null);
  }

  async function handleSend() {
    if (!token || !session || sending) {
      return;
    }

    const queue = files.filter(
      (entry) => !entry.localInvalid && entry.status !== 'success',
    );

    if (queue.length === 0) {
      return;
    }

    setSending(true);
    setGlobalError(null);
    setCompletion(null);

    let failures = 0;

    for (const entry of queue) {
      updateFile(entry.id, {
        status: 'authorizing',
        progress: null,
        error: null,
      });

      try {
        const authorization = await authorizeUpload(
          token,
          entry.file.name,
          entry.file.size,
        );

        updateFile(entry.id, { status: 'uploading', progress: null });

        await uploadPdfToSignedUrl(
          authorization.signedUrl,
          entry.file,
          (progress) => updateFile(entry.id, { progress }),
        );

        updateFile(entry.id, { status: 'finalizing', progress: 100 });

        await finalizeUpload(token, authorization.intentId);

        updateFile(entry.id, {
          status: 'success',
          progress: 100,
          error: null,
        });
      } catch (uploadError) {
        failures += 1;
        updateFile(entry.id, {
          status: 'error',
          progress: null,
          error: describeUploadError(uploadError),
        });
      }
    }

    setSending(false);

    if (failures === 0) {
      setCompletion(
        `${fileCountLabel(queue.length)} envoyé${queue.length > 1 ? 's' : ''} et vérifié${queue.length > 1 ? 's' : ''}. L’imprimerie peut maintenant traiter vos documents.`,
      );
    } else {
      setGlobalError(
        `${fileCountLabel(queue.length - failures)} sur ${queue.length} envoyé${queue.length > 1 ? 's' : ''}. Corrigez les fichiers en échec puis réessayez.`,
      );
    }
  }

  function resetUploader() {
    if (sending) {
      return;
    }

    setFiles([]);
    setGlobalError(null);
    setCompletion(null);
  }

  const allSuccess =
    files.length > 0 && files.every((entry) => entry.status === 'success');
  const sendableCount = files.filter(
    (entry) => !entry.localInvalid && entry.status !== 'success',
  ).length;
  const validFileCount = files.filter((entry) => !entry.localInvalid).length;
  const limitReached = session ? validFileCount >= session.maxFiles : false;

  return (
    <div className="container deposit-page">
      <section className="deposit-card">
        <Link className="back-link" to={ROUTES.home}>
          <ArrowLeft size={16} aria-hidden="true" />
          Accueil {APP_NAME}
        </Link>

        {loading ? (
          <p className="empty-state">Vérification de la session…</p>
        ) : error ? (
          <div className="deposit-card__body">
            <span className="deposit-icon deposit-icon--error" aria-hidden="true">
              <XCircle size={30} />
            </span>
            <h1>Session inaccessible</h1>
            <p>{error}</p>
            <p className="form-note">
              Demandez à l’imprimerie de créer une nouvelle session.
            </p>
          </div>
        ) : session ? (
          <div className="deposit-card__body">
            <span
              className={`deposit-icon ${
                session.valid
                  ? 'deposit-icon--success'
                  : 'deposit-icon--error'
              }`}
              aria-hidden="true"
            >
              {session.valid ? <UploadCloud size={30} /> : <XCircle size={30} />}
            </span>
            <h1>
              {session.valid ? 'Envoyez vos fichiers PDF' : 'Session indisponible'}
            </h1>
            <p>
              {session.valid
                ? 'Sélectionnez un ou plusieurs PDF, puis envoyez-les directement à l’imprimerie.'
                : session.status === 'closed'
                  ? 'Cette session a été fermée par l’imprimerie.'
                  : 'Cette session a expiré. Demandez un nouveau QR Code.'}
            </p>

            <dl className="session-details session-details--centered">
              <div>
                <dt>
                  <Clock size={15} aria-hidden="true" /> Expiration
                </dt>
                <dd>{dateTimeFormatter.format(new Date(session.expiresAt))}</dd>
              </div>
              <div>
                <dt>
                  <FileText size={15} aria-hidden="true" /> Fichiers
                </dt>
                <dd>{session.maxFiles} maximum</dd>
              </div>
              <div>
                <dt>
                  <ShieldCheck size={15} aria-hidden="true" /> Taille maximale
                </dt>
                <dd>{formatBytes(session.maxFileSizeBytes)} par fichier</dd>
              </div>
            </dl>

            {session.valid ? (
              <div className="uploader">
                {!allSuccess ? (
                  <>
                    <label
                      className={`upload-picker ${
                        sending || limitReached ? 'upload-picker--disabled' : ''
                      }`}
                    >
                      <UploadCloud size={28} aria-hidden="true" />
                      <span className="upload-picker__title">
                        {limitReached
                          ? 'Limite de fichiers atteinte'
                          : 'Sélectionner des fichiers PDF'}
                      </span>
                      <span className="upload-picker__hint">
                        {limitReached
                          ? 'Retirez un fichier pour en ajouter un autre.'
                          : `Jusqu’à ${fileCountLabel(session.maxFiles)} · ${formatBytes(session.maxFileSizeBytes)} maximum par fichier`}
                      </span>
                      <input
                        className="upload-picker__input"
                        type="file"
                        accept=".pdf,application/pdf"
                        multiple
                        onChange={handleFileSelection}
                        disabled={sending || limitReached}
                      />
                    </label>

                    <p className="notice notice--inline uploader__notice">
                      <ShieldCheck size={17} aria-hidden="true" />
                      Le PDF est envoyé directement vers un stockage privé. Son
                      contenu et son authenticité sont vérifiés avant
                      l’enregistrement.
                    </p>
                  </>
                ) : null}

                {files.length > 0 ? (
                  <ul className="upload-list">
                    {files.map((entry) => {
                      const active =
                        entry.status === 'authorizing' ||
                        entry.status === 'uploading' ||
                        entry.status === 'finalizing';

                      return (
                        <li
                          className={`upload-file upload-file--${entry.status}`}
                          key={entry.id}
                        >
                          <span className="upload-file__icon" aria-hidden="true">
                            {entry.status === 'success' ? (
                              <CheckCircle2 size={20} />
                            ) : entry.status === 'error' ? (
                              <AlertCircle size={20} />
                            ) : active ? (
                              <LoaderCircle
                                className="spin"
                                size={20}
                              />
                            ) : (
                              <FileText size={20} />
                            )}
                          </span>

                          <div className="upload-file__main">
                            <div className="upload-file__heading">
                              <span
                                className="upload-file__name"
                                title={entry.file.name}
                              >
                                {entry.file.name}
                              </span>
                              <span className="upload-file__size">
                                {formatBytes(entry.file.size)}
                              </span>
                            </div>

                            {active ? (
                              <div
                                className={`upload-progress ${
                                  entry.progress === null
                                    ? 'upload-progress--indeterminate'
                                    : ''
                                }`}
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={entry.progress ?? undefined}
                                aria-label={`Envoi de ${entry.file.name}`}
                              >
                                <span
                                  style={
                                    entry.progress === null
                                      ? undefined
                                      : { width: `${entry.progress}%` }
                                  }
                                />
                              </div>
                            ) : null}

                            {entry.error ? (
                              <p className="upload-file__error" role="alert">
                                {entry.error}
                              </p>
                            ) : null}
                          </div>

                          <div className="upload-file__aside">
                            <span className="upload-file__status">
                              {statusLabel(entry)}
                            </span>
                            {!sending && entry.status !== 'success' ? (
                              <button
                                className="icon-button"
                                type="button"
                                onClick={() => removeFile(entry.id)}
                                aria-label={`Retirer ${entry.file.name}`}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {globalError ? (
                  <p className="alert alert--error" role="alert">
                    {globalError}
                  </p>
                ) : null}

                {allSuccess ? (
                  <div className="upload-success" role="status">
                    <CheckCircle2 size={26} aria-hidden="true" />
                    <div>
                      <strong>Envoi terminé</strong>
                      <p>{completion}</p>
                    </div>
                    <button
                      className="btn btn--ghost btn--small"
                      type="button"
                      onClick={resetUploader}
                    >
                      Envoyer d’autres fichiers
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn--primary btn--block uploader__submit"
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || sendableCount === 0}
                  >
                    {sending ? (
                      <LoaderCircle className="spin" size={18} aria-hidden="true" />
                    ) : (
                      <Send size={18} aria-hidden="true" />
                    )}
                    {sending
                      ? 'Envoi en cours…'
                      : sendableCount === 0
                        ? 'Ajoutez un fichier PDF'
                        : `Envoyer ${fileCountLabel(sendableCount)}`}
                  </button>
                )}
              </div>
            ) : (
              <p className="form-note">
                Aucun fichier ne peut être déposé avec ce lien.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
