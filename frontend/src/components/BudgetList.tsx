import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Orcamento {
  id: number;
  categoria_id: number;
  valor_limite: number;
}

interface GastoCategoria {
  categoria: string;
  total: number;
}

interface Categoria {
  id: number;
  nome: string;
}

interface Props {
  ano: number;
  mes: number;
  gastosPorCategoria: GastoCategoria[];
  categorias: Categoria[];
  onChange?: () => void;
}

const BudgetList: React.FC<Props> = ({ ano, mes, gastosPorCategoria, categorias, onChange }) => {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);

  useEffect(() => {
    apiFetch(`${API_BASE}/orcamentos?ano=${ano}&mes=${mes}`)
      .then(res => res.json())
      .then(data => setOrcamentos(data));
  }, [ano, mes, onChange]);

  const getCategoriaNome = (catId: number) => {
    const cat = categorias.find(c => c.id === catId);
    return cat ? cat.nome : '...';
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Deseja realmente excluir este orçamento?')) {
      apiFetch(`${API_BASE}/orcamentos/${id}`, { method: 'DELETE' })
        .then(res => {
          if (!res.ok) throw new Error('Erro ao excluir orçamento');
          onChange && onChange();
        })
        .catch(err => alert(err.message));
    }
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Orçamentos do Mês</h3>
      <div style={styles.listContainer}>
        {orcamentos.length === 0 ? (
          <p style={styles.emptyText}>Nenhum orçamento definido para este mês.</p>
        ) : (
          orcamentos.map(orcamento => {
            const categoriaNome = getCategoriaNome(orcamento.categoria_id);
            const gasto = gastosPorCategoria.find(g => g.categoria === categoriaNome);
            const valorGasto = gasto ? Math.abs(gasto.total) : 0;
            const perc = orcamento.valor_limite > 0 ? Math.min(100, (valorGasto / orcamento.valor_limite) * 100) : 0;
            const corProgresso = perc >= 100 ? '#e53935' : perc > 80 ? '#ffb300' : '#43a047';

            return (
              <div key={orcamento.id} style={styles.budgetItem}>
                <div style={styles.itemHeader}>
                  <span style={styles.categoryName}>{categoriaNome}</span>
                  <button
                    style={styles.deleteBtn}
                    title="Excluir orçamento"
                    onClick={() => handleDelete(orcamento.id)}
                  >
                    🗑️
                  </button>
                </div>
                <div style={styles.progressBarContainer}>
                  <div
                    style={{
                      ...styles.progressBar,
                      width: `${perc}%`,
                      background: corProgresso
                    }}
                  />
                </div>
                <div style={styles.valueText}>
                  <span>{valorGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  <span style={{ color: 'var(--color-text-light)' }}>
                    / {orcamento.valor_limite.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
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
    marginBottom: '16px'
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  emptyText: {
    color: 'var(--color-text-light)',
    textAlign: 'center',
    padding: '16px 0'
  },
  budgetItem: {
    width: '100%'
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  categoryName: {
    fontWeight: 600
  },
  deleteBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '1rem',
    opacity: 0.6,
    transition: 'opacity 0.2s',
  },
  progressBarContainer: {
    width: '100%',
    height: '8px',
    background: '#eee',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.5s ease-in-out'
  },
  valueText: {
    marginTop: '6px',
    fontSize: '0.85rem',
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 500
  }
};

export default BudgetList;
