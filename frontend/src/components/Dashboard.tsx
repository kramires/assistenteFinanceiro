import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  LineChart,
  Line,
} from 'recharts';

interface GastoCategoria {
  categoria: string;
  total: number;
}

interface EvolucaoMensal {
  mes: string;
  total: number;
}

interface ResumoMesAnual {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
  saldo_acumulado: number;
}

interface DashboardProps {
  gastosCategoria: GastoCategoria[];
  evolucaoMensal: EvolucaoMensal[];
  resumoAnual: ResumoMesAnual[];
  ano: number;
}

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const COLORS = [
  '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#be185d', '#4f46e5', '#0d9488',
];
const COLOR_RECEITAS = 'var(--color-success)';
const COLOR_DESPESAS = 'var(--color-error)';
const COLOR_SALDO = 'var(--color-primary)';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatYAxis = (tick: number) => {
    return `R$ ${new Intl.NumberFormat('pt-BR', {
        notation: 'compact',
        compactDisplay: 'short'
    }).format(tick)}`;
};

const Dashboard: React.FC<DashboardProps> = ({ gastosCategoria, evolucaoMensal, resumoAnual = [], ano }) => {
  const resumoComLabel = resumoAnual.map((r) => {
    const mesNum = parseInt(r.mes.split('-')[1], 10);
    return { ...r, mesLabel: MESES_LABELS[mesNum - 1] ?? r.mes };
  });
  const temReceitasOuDespesas = resumoComLabel.some((r) => r.receitas > 0 || r.despesas > 0);
  const temSaldoAcumulado = resumoComLabel.some((r) => r.saldo_acumulado !== 0);

  // Garante que todos os valores de gastos sejam positivos para os gráficos
  const gastosPositivos = [...gastosCategoria]
    .map(g => ({
      ...g,
      total: Math.abs(g.total),
    }))
    // Ordena do maior para o menor para melhor leitura visual
    .sort((a, b) => b.total - a.total);

  // 1. Calcula a soma total dos gastos para usar no cálculo manual da porcentagem
  const totalGastos = gastosPositivos.reduce((acc, entry) => acc + entry.total, 0);

  // 2. Tooltip personalizado que calcula a porcentagem manualmente
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { name, value } = payload[0];
      // Cálculo seguro da porcentagem
      const percent = totalGastos > 0 ? (value / totalGastos) * 100 : 0;
      return (
        <div style={styles.tooltip}>
          <p>{`${name}: ${formatCurrency(value)} (${percent.toFixed(1)}%)`}</p>
        </div>
      );
    }
    return null;
  };

  // 3. Dados de evolução mensal em valor absoluto e média para linha de referência
  const evolucaoAbsoluta = evolucaoMensal.map(e => ({
    ...e,
    total: Math.abs(e.total),
  }));

  const mediaGastosAno =
    evolucaoAbsoluta.length > 0
      ? evolucaoAbsoluta.reduce((acc, e) => acc + e.total, 0) / evolucaoAbsoluta.length
      : 0;

  return (
    <div style={styles.dashboardGrid}>
      <div style={styles.chartCard}>
        <h3>Gastos por Categoria</h3>
        {gastosPositivos.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={gastosPositivos}
                  dataKey="total"
                  nameKey="categoria"
                  cx="50%"
                  cy="45%"
                  innerRadius={70}
                  outerRadius={110}
                  fill="#8884d8"
                  isAnimationActive={true}
                >
                  {gastosPositivos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  iconSize={8}
                  iconType="square"
                  wrapperStyle={{ fontSize: '0.75rem', flexWrap: 'wrap', maxWidth: '100%' }}
                  layout="horizontal"
                  align="center"
                />
              </PieChart>
          </ResponsiveContainer>
        ) : <p style={styles.emptyText}>Sem dados de gastos para este mês.</p>}
        {gastosPositivos.length > 0 && (
          <div style={styles.totalFooter}>
            Total de gastos no mês:{' '}
            <strong>{formatCurrency(totalGastos)}</strong>
          </div>
        )}
      </div>
      <div style={styles.chartCard}>
        <h3>Evolução Mensal de Gastos ({ano})</h3>
        {evolucaoMensal.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
              <BarChart data={evolucaoAbsoluta} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0.2}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{fontSize: '0.8rem'}} />
                <YAxis tickFormatter={formatYAxis} width={80} tick={{fontSize: '0.8rem'}}/>
                <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} />
                {mediaGastosAno > 0 && (
                  <ReferenceLine
                    y={mediaGastosAno}
                    stroke="#999"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Média anual',
                      position: 'right',
                      fontSize: 10,
                      fill: '#666',
                    }}
                  />
                )}
                <Bar dataKey="total" fill="url(#colorTotal)" radius={[4, 4, 0, 0]} />
              </BarChart>
          </ResponsiveContainer>
        ) : <p style={styles.emptyText}>Sem dados de evolução para este ano.</p>}
      </div>

      <div style={styles.chartCard}>
        <h3>Receitas x Despesas ({ano})</h3>
        {temReceitasOuDespesas ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={resumoComLabel} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mesLabel" tick={{ fontSize: '0.8rem' }} />
              <YAxis tickFormatter={formatYAxis} width={80} tick={{ fontSize: '0.8rem' }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                cursor={{ fill: 'rgba(206, 206, 206, 0.2)' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.mesLabel}
              />
              <Legend />
              <Bar dataKey="receitas" name="Receitas" fill={COLOR_RECEITAS} radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill={COLOR_DESPESAS} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={styles.emptyText}>Sem dados de receitas ou despesas para este ano.</p>
        )}
      </div>

      <div style={styles.chartCard}>
        <h3>Saldo acumulado no ano ({ano})</h3>
        {temSaldoAcumulado ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={resumoComLabel} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mesLabel" tick={{ fontSize: '0.8rem' }} />
              <YAxis tickFormatter={formatYAxis} width={80} tick={{ fontSize: '0.8rem' }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.mesLabel}
              />
              <ReferenceLine y={0} stroke="#999" strokeDasharray="2 2" />
              <Line
                type="monotone"
                dataKey="saldo_acumulado"
                name="Saldo acumulado"
                stroke={COLOR_SALDO}
                strokeWidth={2}
                dot={{ fill: COLOR_SALDO, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={styles.emptyText}>Sem dados de saldo acumulado para este ano.</p>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    marginTop: '24px'
  },
  chartCard: {
    background: 'var(--color-surface)',
    padding: '24px',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--box-shadow)'
  },
  tooltip: {
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #ccc',
    padding: '10px',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--box-shadow)'
  },
  emptyText: {
    textAlign: 'center',
    color: 'var(--color-text-light)',
    paddingTop: '80px'
  },
  totalFooter: {
    marginTop: '12px',
    fontSize: '0.95rem',
    color: 'var(--color-text-dark)',
    textAlign: 'center'
  }
};

export default Dashboard;
