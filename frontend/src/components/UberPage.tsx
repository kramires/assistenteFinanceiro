import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';
import {
  Bar,
  Cell,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import TransactionForm from './TransactionForm';

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

interface UberResumo {
  total_mes: number;
  total_ano: number;
  quantidade_mes: number;
}

interface UberEvolucaoMes {
  mes: string;
  uber_mes: number;
  uber_acumulado: number;
  despesas_mes: number;
  percentual_uber_despesas: number;
}

interface Props {
  ano: number;
  mes: number;
}

const UberPage: React.FC<Props> = ({ ano, mes }) => {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [resumo, setResumo] = useState<UberResumo | null>(null);
  const [evolucao, setEvolucao] = useState<UberEvolucaoMes[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transacaoEmEdicao, setTransacaoEmEdicao] = useState<Transacao | null>(null);
  const [financiamentoMensal, setFinanciamentoMensal] = useState('1500');
  const [seguroMensal, setSeguroMensal] = useState('250');
  const [combustivelMensal, setCombustivelMensal] = useState('500');
  const [manutencaoAnual, setManutencaoAnual] = useState('5000');

  const carregarDados = () => {
    apiFetch(`${API_BASE}/transporte-app/transacoes?ano=${ano}&mes=${mes}`)
      .then((res) => res.json())
      .then((data) => setTransacoes(data || []))
      .catch(() => setTransacoes([]));

    apiFetch(`${API_BASE}/transporte-app/resumo?ano=${ano}&mes=${mes}`)
      .then((res) => res.json())
      .then((data) => setResumo(data))
      .catch(() => setResumo({ total_mes: 0, total_ano: 0, quantidade_mes: 0 }));

    apiFetch(`${API_BASE}/transporte-app/evolucao?ano=${ano}`)
      .then((res) => res.json())
      .then((data) => setEvolucao(data || []))
      .catch(() => setEvolucao([]));
  };

  useEffect(() => {
    carregarDados();
  }, [ano, mes]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const evolucaoComLabel = useMemo(
    () =>
      evolucao.map((e, index) => {
        const mesNum = parseInt(e.mes.split('-')[1], 10);
        return { ...e, mesLabel: meses[mesNum - 1] || e.mes, mesIndex: index + 1 };
      }),
    [evolucao]
  );

  const custoCarroAnual = useMemo(() => {
    const financiamento = Number(financiamentoMensal.replace(',', '.')) || 0;
    const seguro = Number(seguroMensal.replace(',', '.')) || 0;
    const combustivel = Number(combustivelMensal.replace(',', '.')) || 0;
    const manutencao = Number(manutencaoAnual.replace(',', '.')) || 0;
    return (financiamento + seguro + combustivel) * 12 + manutencao;
  }, [financiamentoMensal, seguroMensal, combustivelMensal, manutencaoAnual]);

  const custoCarroMensalTotal = useMemo(() => {
    const financiamento = Number(financiamentoMensal.replace(',', '.')) || 0;
    const seguro = Number(seguroMensal.replace(',', '.')) || 0;
    const combustivel = Number(combustivelMensal.replace(',', '.')) || 0;
    return financiamento + seguro + combustivel;
  }, [financiamentoMensal, seguroMensal, combustivelMensal]);

  const fmtYAxisCompact = (tick: number) =>
    `R$ ${new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(tick)}`;

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
    carregarDados();
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Deseja realmente excluir este lançamento?')) {
      apiFetch(`${API_BASE}/transacoes/${id}`, { method: 'DELETE' })
        .then(() => carregarDados());
    }
  };

  const custoCarroMensalComManutencao = useMemo(() => {
    const manutencao = Number(manutencaoAnual.replace(',', '.')) || 0;
    return custoCarroMensalTotal + manutencao / 12;
  }, [custoCarroMensalTotal, manutencaoAnual]);

  const comparativoMensal = useMemo(
    () =>
      evolucaoComLabel.map((e) => ({
        ...e,
        custo_carro_mensal: custoCarroMensalComManutencao,
      })),
    [evolucaoComLabel, custoCarroMensalComManutencao]
  );

  return (
    <div style={styles.container}>
      <h2 style={{ marginTop: 0 }}>Controle de Transporte por Aplicativo</h2>
      <p style={styles.subtitle}>
        Gastos com Uber, 99, taxi e transporte escolar ficam visiveis aqui e nas movimentacoes.
        Apenas Uber/99/taxi/transporte por app nao entram no dashboard mensal.
      </p>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryTitle}>Total transporte app no mes</div>
          <div style={{ ...styles.summaryValue, color: 'var(--color-error)' }}>
            {formatCurrency(resumo?.total_mes || 0)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryTitle}>Total transporte app no ano</div>
          <div style={{ ...styles.summaryValue, color: 'var(--color-primary)' }}>
            {formatCurrency(resumo?.total_ano || 0)}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryTitle}>Quantidade de viagens no mes</div>
          <div style={styles.summaryValue}>{resumo?.quantidade_mes || 0}</div>
        </div>
      </div>

      <div style={styles.custosConfigCard}>
        <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Parametros de custo do carro</h3>
        <div style={styles.custosGrid}>
          <div style={styles.campoWrap}>
            <label htmlFor="financiamento" style={styles.custoLabel}>Financiamento / mes</label>
            <input
              id="financiamento"
              type="number"
              min={0}
              step="0.01"
              value={financiamentoMensal}
              onChange={(e) => setFinanciamentoMensal(e.target.value)}
              style={styles.custoInput}
            />
          </div>
          <div style={styles.campoWrap}>
            <label htmlFor="seguro" style={styles.custoLabel}>Seguro / mes</label>
            <input
              id="seguro"
              type="number"
              min={0}
              step="0.01"
              value={seguroMensal}
              onChange={(e) => setSeguroMensal(e.target.value)}
              style={styles.custoInput}
            />
          </div>
          <div style={styles.campoWrap}>
            <label htmlFor="combustivel" style={styles.custoLabel}>Combustivel / mes</label>
            <input
              id="combustivel"
              type="number"
              min={0}
              step="0.01"
              value={combustivelMensal}
              onChange={(e) => setCombustivelMensal(e.target.value)}
              style={styles.custoInput}
            />
          </div>
          <div style={styles.campoWrap}>
            <label htmlFor="manutencao" style={styles.custoLabel}>Manutencao / ano</label>
            <input
              id="manutencao"
              type="number"
              min={0}
              step="0.01"
              value={manutencaoAnual}
              onChange={(e) => setManutencaoAnual(e.target.value)}
              style={styles.custoInput}
            />
          </div>
        </div>
        <p style={{ ...styles.chartSubtitle, marginBottom: 0 }}>
          Referencia anual de carro: <strong>{formatCurrency(custoCarroAnual)}</strong> | custo mensal estimado:{' '}
          <strong>{formatCurrency(custoCarroMensalComManutencao)}</strong>
        </p>
      </div>

      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <h3 style={{ margin: 0 }}>Comparativo mensal: transporte app x custo mensal do carro</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={comparativoMensal} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mesLabel" tick={{ fontSize: '0.8rem' }} />
              <YAxis tickFormatter={fmtYAxisCompact} width={80} tick={{ fontSize: '0.8rem' }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="uber_mes" name="Transporte app no mes" radius={[4, 4, 0, 0]}>
                {comparativoMensal.map((item, index) => (
                  <Cell
                    key={`mes-${index}`}
                    fill={item.uber_mes > item.custo_carro_mensal ? '#d32f2f' : '#1e88e5'}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="custo_carro_mensal"
                name="Custo mensal do carro (estimado)"
                stroke="#c62828"
                strokeWidth={2}
                dot={false}
                strokeDasharray="6 4"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartCard}>
          <h3 style={{ marginTop: 0 }}>Participacao do transporte app nas despesas mensais</h3>
          <p style={styles.chartSubtitle}>
            Percentual de UBER em relacao as despesas do dashboard (sem dupla contagem da fatura).
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={evolucaoComLabel} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mesLabel" tick={{ fontSize: '0.8rem' }} />
              <YAxis
                yAxisId="left"
                tickFormatter={fmtYAxisCompact}
                width={80}
                tick={{ fontSize: '0.8rem' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                width={60}
                tick={{ fontSize: '0.8rem' }}
              />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === '% UBER nas despesas'
                    ? `${value.toFixed(1)}%`
                    : formatCurrency(value)
                }
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="uber_mes"
                name="Transporte app no mes"
                fill="#1e88e5"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                dataKey="percentual_uber_despesas"
                name="% transporte app nas despesas"
                stroke="#7c3aed"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.tableCard}>
        <h3 style={{ marginTop: 0 }}>Lancamentos de transporte app do periodo</h3>
        <div style={styles.tableWrapper}>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descricao</th>
                <th>Origem</th>
                <th>Destino</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'center' }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {transacoes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={styles.emptyState}>
                    Nenhum lancamento de transporte app neste periodo.
                  </td>
                </tr>
              ) : (
                transacoes.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                    <td>{tx.descricao}</td>
                    <td>{tx.origem || '-'}</td>
                    <td>{tx.destino || '-'}</td>
                    <td style={{ ...styles.valor, color: tx.valor < 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {formatCurrency(tx.valor)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => handleEditClick(tx)} style={styles.actionButton}>✏️ Editar</button>
                      <button onClick={() => handleDelete(tx.id)} style={{ ...styles.actionButton, color: 'var(--color-error)' }}>🗑️ Excluir</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  subtitle: {
    marginTop: '-8px',
    color: 'var(--color-text-light)',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    padding: '16px',
    boxShadow: 'var(--box-shadow)',
  },
  summaryTitle: {
    fontSize: '0.9rem',
    color: 'var(--color-text-light)',
    marginBottom: '8px',
  },
  summaryValue: {
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--color-text-dark)',
  },
  tableCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    padding: '20px',
    boxShadow: 'var(--box-shadow)',
  },
  chartCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    padding: '20px',
    boxShadow: 'var(--box-shadow)',
  },
  custosConfigCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    padding: '16px 20px',
    boxShadow: 'var(--box-shadow)',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
    gap: '16px',
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '6px',
  },
  chartSubtitle: {
    marginTop: 0,
    marginBottom: '12px',
    fontSize: '0.9rem',
    color: 'var(--color-text-light)',
  },
  custosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
    marginBottom: '8px',
  },
  campoWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  custoLabel: {
    fontSize: '0.85rem',
    color: 'var(--color-text-light)',
    fontWeight: 500,
  },
  custoInput: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
    fontSize: '0.9rem',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  emptyState: {
    textAlign: 'center',
    color: 'var(--color-text-light)',
    padding: '24px',
  },
  valor: {
    textAlign: 'right',
    fontWeight: 700,
    fontFamily: 'monospace, sans-serif',
  },
  actionButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    padding: '6px',
    borderRadius: '6px',
    margin: '0 2px',
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
    maxWidth: '700px',
    background: 'white',
    borderRadius: 'var(--border-radius)',
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
  },
};

export default UberPage;
