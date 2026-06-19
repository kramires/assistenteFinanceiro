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

interface EvolucaoMes {
  mes: string;
  total: number;
  por_categoria: { categoria: string; total: number }[];
}

interface AnaliseIA {
  resumo_executivo?: string;
  nota_saude_financeira?: number;
  pontos_de_atencao?: string[];
  maiores_gastos_analise?: string[];
  recomendacoes?: string[];
  meta_poupanca_sugerida?: string;
  distribuicao_ideal?: Record<string, string>;
  gerado_em?: string;
  erro?: string;
}

const PIE_COLORS = ['#6C63FF', '#FF6584', '#43CFFF', '#FFB347', '#98D8C8', '#FF8B94', '#A78BFA', '#FCA5A5', '#86EFAC', '#FCD34D'];
const BAR_COLORS = ['#6C63FF', '#43CFFF', '#FF6584', '#FFB347', '#98D8C8'];

interface Props {
  mes: string;
}

export default function CartoesDashboard({ mes }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoMes[]>([]);
  const [analise, setAnalise] = useState<AnaliseIA | null>(null);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`${API_BASE}/faturas/dashboard?mes=${mes}`).then(r => r.json()),
      apiFetch(`${API_BASE}/faturas/evolucao-mensal?meses=6`).then(r => r.json()),
    ])
      .then(([dash, evol]) => {
        setData(dash);
        if (Array.isArray(evol)) setEvolucao(evol);
      })
      .finally(() => setLoading(false));
  }, [mes]);

  const gerarAnalise = () => {
    setLoadingAnalise(true);
    apiFetch(`${API_BASE}/dashboard/analise-financeira?meses=6`)
      .then(r => r.json())
      .then(setAnalise)
      .finally(() => setLoadingAnalise(false));
  };

  if (loading) return <div style={styles.loading}>Carregando dashboard...</div>;
  if (!data) return null;

  const temDados = data.total_geral > 0;
  const temEvolucao = evolucao.some(e => e.total > 0);

  // Agrega categorias de todos os meses para ranking geral (últimos 6 meses)
  const catAgregada: Record<string, number> = {};
  for (const mes_ev of evolucao) {
    for (const c of mes_ev.por_categoria) {
      catAgregada[c.categoria] = (catAgregada[c.categoria] || 0) + c.total;
    }
  }
  const topCategorias = Object.entries(catAgregada)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([categoria, total]) => ({ categoria, total: Math.round(total * 100) / 100 }));

  // Formata evolução para o gráfico
  const evolucaoChart = evolucao.map(e => ({
    mes: fmtMes(e.mes),
    total: e.total,
  }));

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
          <div style={styles.kpiLabel}>Categorias no mês</div>
          <div style={styles.kpiValue}>{data.por_categoria.length}</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Média mensal (6m)</div>
          <div style={styles.kpiValue}>
            R$ {evolucao.length > 0
              ? (evolucao.reduce((s, e) => s + e.total, 0) / evolucao.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
              : '0,00'}
          </div>
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
          {/* Donut por categoria do mês */}
          <div style={styles.chartCard}>
            <h4 style={styles.chartTitle}>Por Categoria — {fmtMes(mes)}</h4>
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
                  <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
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

      {/* Evolução mensal (últimos 6 meses) */}
      {temEvolucao && (
        <div style={styles.chartCard}>
          <h4 style={styles.chartTitle}>Evolução dos Gastos no Cartão — Últimos 6 Meses</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={evolucaoChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Total']}
              />
              <Bar dataKey="total" fill="#6C63FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ranking de categorias (últimos 6 meses) */}
      {topCategorias.length > 0 && (
        <div style={styles.chartCard}>
          <h4 style={styles.chartTitle}>Maiores Categorias de Gasto — Últimos 6 Meses</h4>
          <ResponsiveContainer width="100%" height={Math.max(topCategorias.length * 36, 180)}>
            <BarChart
              data={topCategorias}
              layout="vertical"
              margin={{ top: 4, right: 60, left: 10, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`}
                tick={{ fontSize: 10 }}
              />
              <YAxis type="category" dataKey="categoria" tick={{ fontSize: 11 }} width={110} />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Total']}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {topCategorias.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Análise de IA */}
      <div style={styles.analiseCard}>
        <div style={styles.analiseHeader}>
          <div>
            <h4 style={styles.chartTitle}>Análise Financeira com IA</h4>
            <p style={styles.analiseSubtitle}>
              Análise profissional dos seus gastos com recomendações personalizadas
            </p>
          </div>
          <button
            style={loadingAnalise ? styles.btnDisabled : styles.btn}
            onClick={gerarAnalise}
            disabled={loadingAnalise}
          >
            {loadingAnalise ? 'Analisando...' : analise ? 'Reanalisar' : 'Gerar Análise IA'}
          </button>
        </div>

        {analise?.erro && (
          <div style={styles.erroBox}>{analise.erro}</div>
        )}

        {analise && !analise.erro && (
          <div style={styles.analiseBody}>
            {/* Nota de saúde financeira */}
            {analise.nota_saude_financeira != null && (
              <div style={styles.notaBox}>
                <div style={styles.notaLabel}>Saúde Financeira</div>
                <div style={{
                  ...styles.notaValor,
                  color: analise.nota_saude_financeira >= 7 ? '#16A34A' :
                         analise.nota_saude_financeira >= 5 ? '#D97706' : '#DC2626',
                }}>
                  {analise.nota_saude_financeira.toFixed(1)}/10
                </div>
              </div>
            )}

            {/* Resumo executivo */}
            {analise.resumo_executivo && (
              <div style={styles.secao}>
                <div style={styles.secaoTitulo}>Resumo</div>
                <p style={styles.secaoTexto}>{analise.resumo_executivo}</p>
              </div>
            )}

            {/* Pontos de atenção */}
            {analise.pontos_de_atencao && analise.pontos_de_atencao.length > 0 && (
              <div style={styles.secao}>
                <div style={styles.secaoTitulo}>Pontos de Atenção</div>
                <ul style={styles.lista}>
                  {analise.pontos_de_atencao.map((p, i) => (
                    <li key={i} style={styles.listaItem}>
                      <span style={styles.iconAlert}>⚠️</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Análise dos maiores gastos */}
            {analise.maiores_gastos_analise && analise.maiores_gastos_analise.length > 0 && (
              <div style={styles.secao}>
                <div style={styles.secaoTitulo}>Análise dos Maiores Gastos</div>
                <ul style={styles.lista}>
                  {analise.maiores_gastos_analise.map((g, i) => (
                    <li key={i} style={styles.listaItem}>
                      <span style={styles.iconInfo}>📊</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recomendações */}
            {analise.recomendacoes && analise.recomendacoes.length > 0 && (
              <div style={styles.secao}>
                <div style={styles.secaoTitulo}>Recomendações de Especialista</div>
                <ol style={styles.listaNum}>
                  {analise.recomendacoes.map((r, i) => (
                    <li key={i} style={styles.listaItem}>{r}</li>
                  ))}
                </ol>
              </div>
            )}

            <div style={styles.analiseRow}>
              {/* Meta de poupança */}
              {analise.meta_poupanca_sugerida && (
                <div style={styles.metaBox}>
                  <div style={styles.metaLabel}>Meta de Poupança Sugerida</div>
                  <div style={styles.metaValor}>{analise.meta_poupanca_sugerida}</div>
                </div>
              )}

              {/* Distribuição ideal */}
              {analise.distribuicao_ideal && Object.keys(analise.distribuicao_ideal).length > 0 && (
                <div style={styles.distBox}>
                  <div style={styles.metaLabel}>Distribuição Ideal da Renda</div>
                  <div style={styles.distGrid}>
                    {Object.entries(analise.distribuicao_ideal).map(([cat, pct], i) => (
                      <div key={i} style={styles.distItem}>
                        <span style={{ color: PIE_COLORS[i % PIE_COLORS.length], fontWeight: 700 }}>{pct}</span>
                        <span style={styles.distCat}>{cat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {analise.gerado_em && (
              <div style={styles.geradoEm}>
                Análise gerada em {new Date(analise.gerado_em).toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        )}
      </div>

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
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    padding: '16px 18px',
  },
  chartTitle: { margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--color-text-dark)' },

  // Análise IA
  analiseCard: {
    background: 'var(--color-surface)',
    border: '2px solid var(--color-primary)',
    borderRadius: 'var(--border-radius)',
    padding: '20px 22px',
  },
  analiseHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 },
  analiseSubtitle: { margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-text-light)' },
  btn: {
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnDisabled: {
    background: 'var(--color-border)',
    color: 'var(--color-text-light)',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: 'not-allowed',
    whiteSpace: 'nowrap',
  },
  erroBox: {
    marginTop: 12,
    padding: '10px 14px',
    background: '#FEE2E2',
    border: '1px solid #FCA5A5',
    borderRadius: 6,
    color: '#DC2626',
    fontSize: '0.85rem',
  },
  analiseBody: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 },
  notaBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--color-background)',
    borderRadius: 8,
    padding: '12px 16px',
  },
  notaLabel: { fontSize: '0.85rem', color: 'var(--color-text-light)' },
  notaValor: { fontSize: '2rem', fontWeight: 900 },
  secao: {},
  secaoTitulo: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  secaoTexto: { margin: 0, lineHeight: 1.6, color: 'var(--color-text-dark)', fontSize: '0.9rem' },
  lista: { margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  listaNum: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 },
  listaItem: { fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--color-text-dark)' },
  iconAlert: { marginRight: 4 },
  iconInfo: { marginRight: 4 },
  analiseRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  metaBox: {
    flex: 1,
    minWidth: 200,
    background: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: 8,
    padding: '12px 16px',
  },
  metaLabel: { fontSize: '0.78rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  metaValor: { fontSize: '0.95rem', color: '#1E40AF', fontWeight: 600 },
  distBox: {
    flex: 2,
    minWidth: 260,
    background: 'var(--color-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '12px 16px',
  },
  distGrid: { display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginTop: 4 },
  distItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' },
  distCat: { color: 'var(--color-text-dark)' },
  geradoEm: { fontSize: '0.72rem', color: 'var(--color-text-light)', textAlign: 'right', marginTop: 4 },

  // Faturas abertas
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
