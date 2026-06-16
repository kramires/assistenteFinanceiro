import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Lancamento {
  id: number;
  data: string;
  descricao: string;
  valor: number;
  categoria_id: number | null;
  categoria_nome: string | null;
  parcela_atual: number | null;
  total_parcelas: number | null;
}

interface Fatura {
  id: number;
  cartao_nome: string;
  mes_referencia: string;
  data_vencimento: string | null;
  valor_total: number;
  status: string;
  saldo_parcelado: number;
  lancamentos: Lancamento[];
}

interface Categoria {
  id: number;
  nome: string;
}

interface Props {
  faturaId: number;
  categorias: Categoria[];
  onPagar: (faturaId: number, valor: number) => void;
}

export default function LancamentosFatura({ faturaId, categorias, onPagar }: Props) {
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/faturas/${faturaId}`);
      const data = await res.json();
      setFatura(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [faturaId]);

  const handleCatChange = async (lancamentoId: number, categoriaId: number | null) => {
    await apiFetch(`${API_BASE}/faturas/lancamentos/${lancamentoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria_id: categoriaId }),
    });
    setEditingCat(null);
    load();
  };

  if (loading) return <div style={styles.loading}>Carregando lançamentos...</div>;
  if (!fatura) return null;

  const isPaid = fatura.status === 'paga';
  const venc = fatura.data_vencimento
    ? new Date(fatura.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')
    : '—';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>
            {fatura.cartao_nome} — {fatura.mes_referencia}
          </h3>
          <span style={styles.meta}>Vencimento: {venc}</span>
          {fatura.saldo_parcelado > 0 && (
            <span style={{ ...styles.meta, marginLeft: 16 }}>
              Saldo parcelado futuro: R$ {fatura.saldo_parcelado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <div style={styles.headerRight}>
          <div style={styles.totalBig}>
            R$ {fatura.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          {isPaid ? (
            <span style={styles.badgePaga}>PAGA</span>
          ) : (
            <button
              style={styles.btnPagar}
              onClick={() => onPagar(fatura.id, fatura.valor_total)}
            >
              Pagar fatura
            </button>
          )}
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Data</th>
              <th style={styles.th}>Descrição</th>
              <th style={styles.th}>Parcela</th>
              <th style={styles.th}>Categoria</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {fatura.lancamentos.map(l => (
              <tr key={l.id} style={styles.tr}>
                <td style={styles.td}>
                  {new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td style={styles.td}>{l.descricao}</td>
                <td style={styles.td}>
                  {l.parcela_atual && l.total_parcelas ? (
                    <span style={styles.parcelaBadge}>
                      {l.parcela_atual}/{l.total_parcelas}
                    </span>
                  ) : '—'}
                </td>
                <td style={styles.td}>
                  {editingCat === l.id ? (
                    <select
                      autoFocus
                      defaultValue={l.categoria_id ?? ''}
                      onChange={e => handleCatChange(l.id, e.target.value ? Number(e.target.value) : null)}
                      onBlur={() => setEditingCat(null)}
                      style={styles.catSelect}
                    >
                      <option value="">Sem categoria</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      style={styles.catTag}
                      onClick={() => setEditingCat(l.id)}
                      title="Clique para editar"
                    >
                      {l.categoria_nome || 'Sem categoria'}
                    </span>
                  )}
                </td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                  R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
  },
  loading: { padding: 24, color: 'var(--color-text-light)', textAlign: 'center' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-primary-light)',
  },
  title: { margin: '0 0 4px', fontSize: '1rem', color: 'var(--color-text-dark)' },
  meta: { fontSize: '0.8rem', color: 'var(--color-text-light)' },
  headerRight: { textAlign: 'right' },
  totalBig: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--color-primary)',
    marginBottom: 8,
  },
  btnPagar: {
    padding: '6px 16px',
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  badgePaga: {
    padding: '4px 12px',
    background: '#4CAF50',
    color: '#fff',
    borderRadius: 8,
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-light)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1px solid var(--color-border)',
  },
  tr: { borderBottom: '1px solid var(--color-border)' },
  td: {
    padding: '10px 14px',
    fontSize: '0.9rem',
    color: 'var(--color-text-dark)',
  },
  parcelaBadge: {
    background: '#E3F2FD',
    color: '#1565C0',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  catTag: {
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  catSelect: {
    fontSize: '0.85rem',
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--color-border)',
  },
};
