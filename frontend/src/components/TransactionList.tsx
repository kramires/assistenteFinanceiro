import React, { useEffect, useState, useCallback } from 'react';
import TransactionForm from './TransactionForm';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

// Interfaces
interface Categoria {
  id: number;
  nome: string;
  tipo: string;
}

interface Transacao {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  origem?: string | null;
  destino?: string | null;
  categoria_id?: number;
  categoria?: Categoria;
}

interface Props {
  refreshFlag: boolean;
  ano: number;
  mes: number;
}

const TransactionList: React.FC<Props> = ({ refreshFlag, ano, mes }) => {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transacaoEmEdicao, setTransacaoEmEdicao] = useState<Transacao | null>(null);

  const categoriasUnicas = Array.from(
    new Set(transacoes.map(t => t.categoria?.nome).filter(Boolean) as string[])
  ).sort();
  const transacoesExibidas =
    filtroCategoria === 'todas'
      ? transacoes
      : transacoes.filter(t => t.categoria?.nome === filtroCategoria);

  // Função de fetch agora busca diretamente pelo ano E mês
  const fetchTransacoes = useCallback(() => {
    const url = `${API_BASE}/transacoes?ano=${ano}&mes=${mes}`;
    
    apiFetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Falha na resposta da rede');
        return res.json();
      })
      .then(data => {
        setTransacoes(data);
      })
      .catch(err => {
        console.error("Falha ao buscar transações:", err);
        setTransacoes([]); // Limpa a lista em caso de erro
      });
  }, [ano, mes]);

  useEffect(() => {
    fetchTransacoes();
  }, [refreshFlag, fetchTransacoes]);

  const handleEditClick = (transacao: Transacao) => {
    setTransacaoEmEdicao(transacao);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTransacaoEmEdicao(null);
  };

  const handleUpdateSuccess = () => {
    handleCloseModal();
    fetchTransacoes();
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Deseja realmente excluir esta transação?')) {
      apiFetch(`${API_BASE}/transacoes/${id}`, { method: 'DELETE' })
        .then(() => fetchTransacoes());
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={{ marginTop: 0 }}>Transações do Período</h2>
        {categoriasUnicas.length > 0 && (
          <div style={styles.filterWrap}>
            <label htmlFor="filtro-cat" style={styles.filterLabel}>Categoria:</label>
            <select
              id="filtro-cat"
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="todas">Todas</option>
              {categoriasUnicas.map(nome => (
                <option key={nome} value={nome}>{nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div style={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th style={{width: '5%'}}></th>
              <th>Descrição</th>
              <th>Origem</th>
              <th>Destino</th>
              <th>Categoria</th>
              <th style={{width: '15%'}}>Data</th>
              <th style={{width: '15%', textAlign: 'right'}}>Valor</th>
              <th style={{width: '15%', textAlign: 'center'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {transacoesExibidas.length > 0 ? (
              transacoesExibidas.map(tx => (
                <tr key={tx.id}>
                  <td>
                    <div style={{...styles.typeIndicator, background: tx.valor < 0 ? 'var(--color-error)' : 'var(--color-success)'}}></div>
                  </td>
                  <td>{tx.descricao}</td>
                  <td>{tx.origem || '-'}</td>
                  <td>{tx.destino || '-'}</td>
                  <td>
                    <span style={styles.categoryBadge}>{tx.categoria ? tx.categoria.nome : '-'}</span>
                  </td>
                  <td>{new Date(tx.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                  <td style={{ ...styles.valor, color: tx.valor < 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                    {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => handleEditClick(tx)} style={styles.actionButton}>✏️ Editar</button>
                    <button onClick={() => handleDelete(tx.id)} style={{...styles.actionButton, color: 'var(--color-error)'}}>🗑️ Excluir</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={styles.emptyState}>
                  {transacoes.length === 0
                    ? 'Nenhuma transação encontrada para o período selecionado.'
                    : 'Nenhuma transação nesta categoria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <TransactionForm
              modoEdicao={true}
              transacao={transacaoEmEdicao}
              onTransactionUpdated={handleUpdateSuccess}
              onCancel={handleCloseModal}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key:string]: React.CSSProperties } = {
  container: {
    marginTop: '32px',
    background: 'var(--color-surface)',
    padding: '24px',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--box-shadow)'
  },
  headerRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px'
  },
  filterWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  filterLabel: {
    fontSize: '0.9rem',
    color: 'var(--color-text-light)',
    fontWeight: 500
  },
  filterSelect: {
    padding: '6px 10px',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
    fontSize: '0.9rem',
    minWidth: '140px'
  },
  tableWrapper: {
    overflowX: 'auto'
  },
  typeIndicator: {
    width: '4px',
    height: '24px',
    borderRadius: '2px',
  },
  categoryBadge: {
    background: '#eee',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 500
  },
  valor: {
    fontWeight: 'bold',
    textAlign: 'right',
    fontFamily: 'monospace, sans-serif',
    fontSize: '1rem'
  },
  actionButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    padding: '8px',
    borderRadius: '6px',
    margin: '0 4px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: 'var(--color-text-light)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '100%',
    maxWidth: '600px',
    background: 'white',
    borderRadius: 'var(--border-radius)',
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
  }
};

export default TransactionList;
