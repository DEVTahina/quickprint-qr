import { ArrowLeft, Lock, LogIn, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { APP_NAME, ROUTES } from '../../constants/app';
import { useAuth } from '../../contexts/auth-context';

/** Connexion email / mot de passe de l'administrateur via Supabase Auth. */
export default function LoginPage() {
  const { signIn, status, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const locationState = location.state as { from?: string } | null;
  const from =
    locationState?.from?.startsWith('/admin') === true
      ? locationState.from
      : ROUTES.adminDashboard;

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(from, { replace: true });
    }
  }, [status, from, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Connexion impossible. Veuillez reessayer.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const displayedError = formError ?? authError;
  const busy = submitting || status === 'loading';

  return (
    <div className="container auth-page">
      <section className="auth-card">
        <Link className="back-link" to={ROUTES.home}>
          <ArrowLeft size={16} aria-hidden="true" />
          Retour a l’accueil
        </Link>

        <header className="auth-card__header">
          <span className="card__icon" aria-hidden="true">
            <LogIn size={22} />
          </span>
          <h1>Espace administrateur</h1>
          <p>Connectez-vous pour gerer les sessions et les documents de {APP_NAME}.</p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <div className="field__control">
              <Mail size={18} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="admin@imprimerie.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <div className="field__control">
              <Lock size={18} aria-hidden="true" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
                required
              />
            </div>
          </div>

          <button
            className="btn btn--primary btn--block"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {displayedError ? (
          <p className="alert alert--error" role="alert">
            {displayedError}
          </p>
        ) : (
          <p className="form-note">
            Aucune inscription publique. Le compte administrateur est cree manuellement
            dans Supabase.
          </p>
        )}
      </section>
    </div>
  );
}
