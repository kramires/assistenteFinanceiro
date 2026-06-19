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

interface EditFields {
  data: string;
  descricao: string;
  valor: string;
  categoria_id: number | null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function LancamentosFatura({ faturaId, categorias, onPagar }: Props) {
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<EditFields>({ data: '', descricao: '', valor: '', categoria_id: null });
  const [adding, setAdding] = useState(false);
  const [newFields, setNewFields] = useState<EditFields>({ data: todayISO(), descricao: '', valor: '', categoria_id: null });
  const [saving, setSaving] = useState(false);

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

  const startEdit = (l: Lancamento) => {
    setEditingId(l.id);
    setEditFields({ data: l.data, descricao: l.descricao, valor: String(l.valor), categoria_id: l.categoria_id });
    setAdding(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await apiFetch(`${API_BASE}/faturas/lancamentos/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: editFields.data,
          descricao: editFields.descricao,
          valor: parseFloat(editFields.valor) || 0,
          categoria_id: editFields.categoria_id,
        }),
      });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Excluir este lançamento?')) return;
    setSaving(true);
    try {
      await apiFetch(`${API_BASE}/faturas/lancamentos/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!fatura || !newFields.descricao || !newFields.valor) return;
    setSaving(true);
    try {
      await apiFetch(`${API_BASE}/faturas/${fatura.id}/lancamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: newFields.data,
          descricao: newFields.descricao,
          valor: parseFloat(newFields.valor) || 0,
          categoria_id: newFields.categoria_id,
        }),
      });
      setAdding(false);
      setNewFields({ data: todayISO(), descricao: '', valor: '', categoria_id: null });
      await load();
    } finally {
      setSaving(false);
    }
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              style={styles.btnAdd}
              onClick={() => { setAdding(v => !v); setEditingId(null); }}
            >
              {adding ? '✕ Cancelar' : '+ Lancamento'}
            </button>
            {isPaid ? (
              <span style={styles.badgePaga}>PAGA</span>
            ) : (
              <button style={styles.btnPagar} onClick={() => onPagar(fatura.id, fatura.valor_total)}>
                Pagar fatura
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Data</th>
              <th style={styles.th}>Descricao</th>
              <th style={styles.th}>Parcela</th>
              <th style={styles.th}>Categoria</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Valor</th>
              <th style={{ ...styles.th, textAlign: 'center', width: 90 }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {fatura.lancamentos.map(l => (
              <tr key={l.id} style={{ ...styles.tr, background: editingId === l.id ? '#fffde7' : 'transparent' }}>
                {editingId === l.id ? (
                  <>
                    <td style={styles.td}>
                      <input
                        type="date"
                        value={editFields.data}
                        onChange={e => setEditFields(f => ({ ...f, data: e.target.value }))}
                        style={styles.inputInline}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        value={editFields.descricao}
                        onChange={e => setEditFields(f => ({ ...f, descricao: e.target.value }))}
                        style={{ ...styles.inputInline, minWidth: 180 }}
                      />
                    </td>
                    <td style={styles.td}>
                      {l.parcela_atual && l.total_parcelas
                        ? <span style={styles.parcelaBadge}>{l.parcela_atual}/{l.total_parcelas}</span>
                        : '—'}
                    </td>
                    <td style={styles.td}>
                      <select
                        value={editFields.categoria_id ?? ''}
                        onChange={e => setEditFields(f => ({ ...f, categoria_id: e.target.value ? Number(e.target.value) : null }))}
                        style={styles.catSelect}
                      >
                        <option value="">Sem categoria</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={editFields.valor}
                        onChange={e => setEditFields(f => ({ ...f, valor: e.target.value }))}
                        style={{ ...styles.inputInline, width: 90, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={handleSaveEdit} disabled={saving} style={styles.btnSave} title="Salvar">&#10003;</button>
                      <button onClick={() => setEditingId(null)} style={styles.btnIcon} title="Cancelar">&#10007;</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={styles.td}>
                      {new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td style={styles.td}>{l.descricao}</td>
                    <td style={styles.td}>
                      {l.parcela_atual && l.total_parcelas
                        ? <span style={styles.parcelaBadge}>{l.parcela_atual}/{l.total_parcelas}</span>
                        : '—'}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.catTag} onClick={() => startEdit(l)} title="Clique para editar">
                        {l.categoria_nome || 'Sem categoria'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                      R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => startEdit(l)} style={styles.btnIcon} title="Editar">&#9998;</button>
                      <button onClick={() => handleDelete(l.id)} disabled={saving} style={styles.btnDelete} title="Excluir">&#10005;</button>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {adding && (
              <tr style={{ ...styles.tr, background: '#e8f5e9' }}>
                <td style={styles.td}>
                  <input
                    type="date"
                    value={newFields.data}
                    onChange={e => setNewFields(f => ({ ...f, data: e.target.value }))}
                    style={styles.inputInline}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    placeholder="Descricao *"
                    value={newFields.descricao}
                    onChange={e => setNewFields(f => ({ ...f, descricao: e.target.value }))}
                    style={{ ...styles.inputInline, minWidth: 180 }}
                  />
                </td>
                <td style={styles.td}>—</td>
                <td style={styles.td}>
                  <select
                    value={newFields.categoria_id ?? ''}
                    onChange={e => setNewFields(f => ({ ...f, categoria_id: e.target.value ? Number(e.target.value) : null }))}
                    style={styles.catSelect}
                  >
                    <option value="">Sem categoria</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newFields.valor}
                    onChange={e => setNewFields(f => ({ ...f, valor: e.target.value }))}
                    style={{ ...styles.inputInline, width: 90, textAlign: 'right' }}
                  />
                </td>
                <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={handleAdd}
                    disabled={saving || !newFields.descricao || !newFields.valor}
                    style={styles.btnSave}
                    title="Adicionar"
                  >&#10003;</button>
                  <button onClick={() => setAdding(false)} style={styles.btnIcon} title="Cancelar">&#10007;</button>
                </td>
              </tr>
            )}
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
  btnAdd: {
    padding: '6px 14px',
    background: 'transparent',
    color: 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  badgePaga: {
    padding: '6px 12px',
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
  td: { padding: '10px 14px', fontSize: '0.9rem', color: 'var(--color-text-dark)' },
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
  inputInline: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    fontSize: '0.85rem',
    boxSizing: 'border-box',
  },
  btnIcon: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '2px 5px',
    color: 'var(--color-text-light)',
    borderRadius: 4,
  },
  btnSave: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.1rem',
    padding: '2px 5px',
    color: '#4CAF50',
    fontWeight: 700,
    borderRadius: 4,
  },
  btnDelete: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '2px 5px',
    color: '#f44336',
    borderRadius: 4,
  },
};
