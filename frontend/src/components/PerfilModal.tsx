import React, { useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Props {
  username: string;
  onClose: () => void;
}

export default function PerfilModal({ username, onClose }: Props) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    if (novaSenha !== confirmar) {
      setErro('Nova senha e confirmação não coincidem.');
      return;
    }
    if (novaSenha.length < 6) {
      setErro('Nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const resp = await apiFetch(`${API_BASE}/auth/perfil`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErro(data.detail || 'Erro ao alterar senha.');
      } else {
        setSucesso('Senha alterada com sucesso!');
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmar('');
      }
    } catch {
      setErro('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div style={s.overlay} onClick={handleOverlayClick}>
      <div style={s.modal}>
        <div style={s.header}>
          <h2 style={s.title}>Perfil</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.userRow}>
          <span style={s.userLabel}>Usuário:</span>
          <span style={s.userName}>{username}</span>
        </div>

        <hr style={s.divider} />

        <h3 style={s.sectionTitle}>Alterar Senha</h3>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Senha Atual</label>
            <input
              type="password"
              value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)}
              style={s.input}
              autoComplete="current-password"
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Nova Senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              style={s.input}
              autoComplete="new-password"
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirmar Nova Senha</label>
            <input
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              style={s.input}
              autoComplete="new-password"
              required
            />
          </div>

          {erro && <div style={s.erro}>{erro}</div>}
          {sucesso && <div style={s.sucesso}>{sucesso}</div>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Salvando...' : 'Alterar Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    padding: '28px 32px',
    width: '100%',
    maxWidth: 420,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { margin: 0, fontSize: '1.25rem', color: 'var(--color-text-dark)' },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    color: 'var(--color-text-light)',
    lineHeight: 1,
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  userLabel: { fontSize: '0.9rem', color: 'var(--color-text-light)' },
  userName: { fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-dark)' },
  divider: { border: 'none', borderTop: '1px solid var(--color-border)', margin: '0 0 20px 0' },
  sectionTitle: { margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--color-text-dark)' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: '0.85rem', color: 'var(--color-text-light)' },
  input: {
    padding: '8px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    fontSize: '0.95rem',
    outline: 'none',
    background: 'var(--color-bg)',
    color: 'var(--color-text-dark)',
  },
  erro: {
    padding: '8px 12px',
    background: '#FFF0F0',
    border: '1px solid #FFBCBC',
    borderRadius: 6,
    fontSize: '0.85rem',
    color: '#c0392b',
  },
  sucesso: {
    padding: '8px 12px',
    background: '#F0FFF4',
    border: '1px solid #B7EBC6',
    borderRadius: 6,
    fontSize: '0.85rem',
    color: '#1a7a3e',
  },
  btn: {
    padding: '10px 0',
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
};
