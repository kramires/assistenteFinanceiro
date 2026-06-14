import React, { useState } from 'react';
import { API_BASE } from '../config';
import { setToken } from '../api';

interface Props {
  onLogin: () => void;
}

const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || 'Credenciais inválidas.');
      }

      const data = await resp.json();
      setToken(data.access_token);
      onLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <h1 style={styles.title}>Assistente Financeiro</h1>
        <p style={styles.subtitle}>Entre com suas credenciais para continuar.</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Usuário
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={styles.input}
              required
              autoFocus
            />
          </label>
          <label style={styles.label}>
            Senha
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg, #f0f2f5)',
  },
  card: {
    background: 'var(--color-surface, #fff)',
    borderRadius: 'var(--border-radius, 12px)',
    boxShadow: 'var(--box-shadow, 0 4px 24px rgba(0,0,0,0.10))',
    padding: '40px 48px',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '1.5rem',
    color: 'var(--color-text-dark, #1a1a2e)',
  },
  subtitle: {
    margin: '0 0 32px 0',
    fontSize: '0.95rem',
    color: 'var(--color-text-light, #6b7280)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontWeight: 500,
    fontSize: '0.9rem',
    color: 'var(--color-text-dark, #1a1a2e)',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--color-border, #d1d5db)',
    fontSize: '1rem',
    outline: 'none',
  },
  button: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--color-primary, #1e40af)',
    color: '#fff',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '8px',
  },
  error: {
    margin: 0,
    color: 'var(--color-error, #ef4444)',
    fontSize: '0.9rem',
  },
};

export default LoginPage;
