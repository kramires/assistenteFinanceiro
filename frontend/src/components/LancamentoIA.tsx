import React, { useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Props {
  onLancamentoFeito: () => void;
}

const LancamentoIA: React.FC<Props> = ({ onLancamentoFeito }) => {
  const [texto, setTexto] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Processando...');
    apiFetch(`${API_BASE}/ia/lancar-texto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    })
      .then(async res => {
        let body: { detail?: string | string[] };
        try {
          body = await res.json();
        } catch {
          body = {};
        }
        if (!res.ok) {
          const d = body.detail;
          const msg = Array.isArray(d) ? d.join('. ') : typeof d === 'string' ? d : 'Erro ao processar.';
          throw new Error(msg);
        }
        return body;
      })
      .then(() => {
        setStatus('Lançamento realizado!');
        setTexto('');
        onLancamentoFeito();
      })
      .catch(err => {
        const raw = err.message || 'Erro desconhecido';
        const msg =
          raw === 'Failed to fetch'
            ? 'Verifique sua conexão. Se persistir, confira a chave da API (OpenAI).'
            : raw;
        setStatus('Erro: ' + msg);
      });
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Lançamento Inteligente (IA)</h2>
      <p style={styles.subtitle}>Descreva sua transação e deixe a IA fazer o resto.</p>
      <form onSubmit={handleSubmit}>
        <div style={styles.inputGroup}>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Ex: almoço com cliente R$ 85,50 hoje"
            style={styles.input}
            required
          />
          <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>Lançar</button>
        </div>
        {status && (
          <div style={{...styles.statusMessage, color: status.startsWith('Erro') ? 'var(--color-error)' : 'var(--color-success)' }}>
            {status}
          </div>
        )}
      </form>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius)',
    padding: '24px',
    boxShadow: 'var(--box-shadow)',
  },
  title: {
    marginTop: 0,
    marginBottom: '8px'
  },
  subtitle: {
    marginTop: 0,
    marginBottom: '24px',
    color: 'var(--color-text-light)'
  },
  inputGroup: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    fontSize: '1rem',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
  },
  statusMessage: {
    marginTop: '16px',
    fontWeight: 500
  }
};

export default LancamentoIA;
