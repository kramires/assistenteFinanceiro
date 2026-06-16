import React, { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface DashboardData {
  mes: string;
  total_geral: number;
  por_categoria: { categoria: string; total: number }[];
  por_cartao: { cartao: string; total: number }[];
  faturas_abertas: {
    id: number;
    cartao: string;
    mes_referencia: string;
    vencimento: string | null;
    valor_total: number;
  }[];
}

const PIE_COLORS = ['#6C63FF', '#FF6584', '#43CFFF', '#FFB347', '#98D8C8', '#FF8B94', '#A78BFA', '#FCA5A5'];

interface Props {
  mes: string;
}

export default function CartoesDashboard({ mes }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`${API_BASE}/faturas/dashboard?mes=${mes}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [mes]);

  if (loading) return <div style={styles.loading}>Carregando dashboard...</div>;
  if (!data) return null;

  const temDados = data.total_geral > 0;

  return (
    <div style={styles.wrapper}>
      {/* KPIs */}
      <div style={styles.kpiRow}>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Total Cartões ({fmtMes(mes)})</div>
          <div style={styles.kpiValue}>
            R$ {data.total_geral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Lançamentos</div>
          <div style={styles.kpiValue}>{data.por_categoria.reduce((s, _) => s, 0)}</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Faturas abertas</div>
          <div style={{ ...styles.kpiValue, color: data.faturas_abertas.length > 0 ? '#E53935' : 'inherit' }}>
            {data.faturas_abertas.length}
          </div>
        </div>
      </div>

      {!temDados && (
        <div style={styles.empty}>
          Nenhum lançamento de cartão em {fmtMes(mes)}. Importe uma fatura para ver os dados.
        </div>
      )}

      {temDados && (
        <div style={styles.chartsRow}>
          {/* Donut por categoria */}
          <div style={styles.chartCard}>
            <h4 style={styles.chartTitle}>Por Categoria</h4>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.por_categoria}
                  dataKey="total"
                  nameKey="categoria"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {data.por_categoria.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string) => [
                    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    name,
                  ]}
                />
                <Legend
                  iconSize={10}
                  formatter={(v: string, entry: any) => {
                    const pct = data.total_geral > 0 ? ((entry.payload.total / data.total_geral) * 100).toFixed(0) : 0;
                    return `${v} (${pct}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Barras por cartão */}
          {data.por_cartao.length > 0 && (
            <div style={styles.chartCard}>
              <h4 style={styles.chartTitle}>Por Cartão</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.por_cartao} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="cartao" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v: number) => [
                      `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      'Total',
                    ]}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {data.por_cartao.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Faturas abertas */}
      {data.faturas_abertas.length > 0 && (
        <div style={styles.abertas}>
          <h4 style={styles.chartTitle}>Faturas em Aberto</h4>
          <div style={styles.abertasGrid}>
            {data.faturas_abertas.map(f => (
              <div key={f.id} style={styles.abertaCard}>
                <div style={styles.abertaNome}>{f.cartao}</div>
                <div style={styles.abertaMes}>{fmtMes(f.mes_referencia)}</div>
                {f.vencimento && (
                  <div style={styles.abertaVenc}>
                    Vence {new Date(f.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </div>
                )}
                <div style={styles.abertaValor}>
                  R$ {f.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function fmtMes(mes: string): string {
  if (!mes) return '';
  const [ano, m] = mes.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(m) - 1]}/${ano.slice(2)}`;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 24 },
  loading: { padding: 32, textAlign: 'center', color: 'var(--color-text-light)' },
  empty: {
    padding: 24,
    textAlign: 'center',
    color: 'var(--color-text-light)',
    background: 'var(--color-primary-light)',
    borderRadius: 8,
  },
  kpiRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  kpi: {
    flex: 1,
    minWidth: 140,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    padding: '14px 18px',
  },
  kpiLabel: { fontSize: '0.75rem', color: 'var(--color-text-light)', marginBottom: 4, textTransform: 'uppercase' },
  kpiValue: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)' },
  chartsRow: { display: 'flex', gap: 20, flexWrap: 'wrap' },
  chartCard: {
    flex: 1,
    minWidth: 280,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    padding: '16px 18px',
  },
  chartTitle: { margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--color-text-dark)' },
  abertas: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    padding: '16px 20px',
  },
  abertasGrid: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 },
  abertaCard: {
    minWidth: 160,
    background: '#FFF3E0',
    border: '1px solid #FF9800',
    borderRadius: 8,
    padding: '12px 14px',
  },
  abertaNome: { fontWeight: 700, fontSize: '0.9rem', color: '#E65100', marginBottom: 2 },
  abertaMes: { fontSize: '0.75rem', color: '#BF360C', marginBottom: 4 },
  abertaVenc: { fontSize: '0.75rem', color: 'var(--color-text-light)', marginBottom: 6 },
  abertaValor: { fontSize: '1.1rem', fontWeight: 700, color: '#E53935' },
};
