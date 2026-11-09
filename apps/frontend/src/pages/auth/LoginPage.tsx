import { ArrowLeft, Lock, LogIn, Mail } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { APP_NAME, ROUTES } from '../../constants/app';

/** Page de connexion temporaire : l'authentification reelle arrive en Phase 3. */
export default function LoginPage() {
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(
      "L'authentification sécurisée sera activée à la Phase 3. Aucun identifiant n'est envoyé pour le moment.",
    );
  }

  return (
    <div className="container auth-page">
      <section className="auth-card">
        <Link className="back-link" to={ROUTES.home}>
          <ArrowLeft size={16} aria-hidden="true" />
          Retour à l’accueil
        </Link>

        <header className="auth-card__header">
          <span className="card__icon" aria-hidden="true">
            <LogIn size={22} />
          </span>
          <h1>Espace administrateur</h1>
          <p>Connectez-vous pour gérer les sessions et les documents de {APP_NAME}.</p>
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
                required
              />
            </div>
          </div>

          <button className="btn btn--primary btn--block" type="submit">
            Se connecter
          </button>
        </form>

        {message ? (
          <p className="alert" role="status">
            {message}
          </p>
        ) : (
          <p className="form-note">
            Interface temporaire de la Phase 1 — aucune authentification réelle n’est encore
            branchée.
          </p>
        )}
      </section>
    </div>
  );
}
