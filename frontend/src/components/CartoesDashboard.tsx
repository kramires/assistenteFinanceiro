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

const COLORS = [
  '#6C63FF', '#FF6584', '#43CFFF', '#FFB347', '#98D8C8',
  '#FF8B94', '#A78BFA', '#FCA5A5', '#86EFAC', '#FCD34D',
  '#F97316', '#84CC16', '#06B6D4', '#EC4899', '#8B5CF6',
];

interface Props {
  mes: string;
}

export default function CartoesDashboard({ mes }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoMes[]>([]);
  const [analise, setAnalise] = useState<AnaliseIA | null>(null);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [rankingMes, setRankingMes] = useState<string>('todos');
  const [recategorizando, setRecategorizando] = useState(false);
  const [recatMsg, setRecatMsg] = useState<string | null>(null);
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

  const recategorizar = () => {
    setRecategorizando(true);
    setRecatMsg(null);
    apiFetch(`${API_BASE}/faturas/recategorizar-outros`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        setRecatMsg(`${d.atualizados} lançamentos recategorizados de ${d.total_outros} "Outros".`);
        // recarrega dados
        return Promise.all([
          apiFetch(`${API_BASE}/faturas/dashboard?mes=${mes}`).then(r => r.json()),
          apiFetch(`${API_BASE}/faturas/evolucao-mensal?meses=6`).then(r => r.json()),
        ]);
      })
      .then(([dash, evol]) => {
        setData(dash);
        if (Array.isArray(evol)) setEvolucao(evol);
      })
      .catch(() => setRecatMsg('Erro ao recategorizar.'))
      .finally(() => setRecategorizando(false));
  };

  if (loading) return <div style={styles.loading}>Carregando dashboard...</div>;
  if (!data) return null;

  const temDados = data.total_geral > 0;
  const temEvolucao = evolucao.some(e => e.total > 0);

  // Dados para o ranking conforme filtro de mês
  let rankingData: { categoria: string; total: number }[] = [];
  if (rankingMes === 'todos') {
    const agg: Record<string, number> = {};
    for (const e of evolucao) {
      for (const c of e.por_categoria) {
        agg[c.categoria] = (agg[c.categoria] || 0) + c.total;
      }
    }
    rankingData = Object.entries(agg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([categoria, total]) => ({ categoria, total: Math.round(total * 100) / 100 }));
  } else {
    const found = evolucao.find(e => e.mes === rankingMes);
    rankingData = (found?.por_categoria || []).slice(0, 10);
  }

  // Evolução chart data
  const evolucaoChart = evolucao.map(e => ({ mes: fmtMes(e.mes), total: e.total }));

  // % de Outros no mês atual
  const totalMes = data.por_categoria.reduce((s, c) => s + c.total, 0);
  const outrosMes = data.por_categoria.find(c => c.categoria === 'Outros')?.total || 0;
  const pctOutros = totalMes > 0 ? (outrosMes / totalMes * 100).toFixed(0) : '0';

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

      {/* Recategorizar Outros */}
      {parseInt(pctOutros) > 10 && (
        <div style={styles.outrosAlert}>
          <div>
            <strong>{pctOutros}% dos gastos</strong> de {fmtMes(mes)} estão em "Outros" (sem categoria).{' '}
            {recatMsg && <span style={{ color: '#16A34A' }}>{recatMsg}</span>}
          </div>
          <button
            style={recategorizando ? styles.btnSmallDisabled : styles.btnSmall}
            onClick={recategorizar}
            disabled={recategorizando}
          >
            {recategorizando ? 'Categorizando...' : 'Recategorizar via IA'}
          </button>
        </div>
      )}
      {recatMsg && parseInt(pctOutros) <= 10 && (
        <div style={{ ...styles.outrosAlert, background: '#F0FDF4', borderColor: '#86EFAC' }}>
          <span style={{ color: '#16A34A' }}>{recatMsg}</span>
        </div>
      )}

      {/* Gráficos do mês */}
      {temDados && (
        <>
          {/* Donut por categoria — full width com legenda personalizada */}
          <div style={styles.chartCard}>
            <h4 style={styles.chartTitle}>Por Categoria — {fmtMes(mes)}</h4>
            <div style={styles.pieRow}>
              <div style={{ width: 260, flexShrink: 0 }}>
                <ResponsiveContainer width={260} height={240}>
                  <PieChart>
                    <Pie
                      data={data.por_categoria}
                      dataKey="total"
                      nameKey="categoria"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={2}
                    >
                      {data.por_categoria.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={styles.pieLegend}>
                {data.por_categoria.map((c, i) => {
                  const pct = totalMes > 0 ? ((c.total / totalMes) * 100).toFixed(1) : '0';
                  return (
                    <div key={i} style={styles.pieLegendItem}>
                      <span style={{ ...styles.pieDot, background: COLORS[i % COLORS.length] }} />
                      <span style={styles.pieCatName}>{c.categoria}</span>
                      <span style={styles.pieCatPct}>{pct}%</span>
                      <span style={styles.pieCatVal}>
                        R$ {c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Por Cartão */}
          {data.por_cartao.length > 0 && (
            <div style={styles.chartCard}>
              <h4 style={styles.chartTitle}>Por Cartão — {fmtMes(mes)}</h4>
              <ResponsiveContainer width="100%" height={Math.max(data.por_cartao.length * 50, 120)}>
                <BarChart
                  data={data.por_cartao}
                  layout="vertical"
                  margin={{ top: 4, right: 80, left: 10, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    type="number"
                    tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis type="category" dataKey="cartao" tick={{ fontSize: 12 }} width={120} />
                  <Tooltip
                    formatter={(v: number) => [
                      `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      'Total',
                    ]}
                  />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={36}>
                    {data.por_cartao.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Evolução mensal (últimos 6 meses) */}
      {temEvolucao && (
        <div style={styles.chartCard}>
          <h4 style={styles.chartTitle}>Evolução dos Gastos no Cartão — Últimos 6 Meses</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={evolucaoChart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Total']}
              />
              <Bar dataKey="total" fill="#6C63FF" radius={[5, 5, 0, 0]} barSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ranking de categorias com filtro de mês */}
      {rankingData.length > 0 && (
        <div style={styles.chartCard}>
          <div style={styles.rankingHeader}>
            <h4 style={styles.chartTitle}>Maiores Categorias de Gasto</h4>
            <div style={styles.rankingFiltros}>
              <button
                style={rankingMes === 'todos' ? styles.filtroAtivo : styles.filtro}
                onClick={() => setRankingMes('todos')}
              >
                6 meses
              </button>
              {evolucao.map(e => (
                <button
                  key={e.mes}
                  style={rankingMes === e.mes ? styles.filtroAtivo : styles.filtro}
                  onClick={() => setRankingMes(e.mes)}
                >
                  {fmtMes(e.mes)}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(rankingData.length * 38, 180)}>
            <BarChart
              data={rankingData}
              layout="vertical"
              margin={{ top: 4, right: 80, left: 10, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`}
                tick={{ fontSize: 10 }}
              />
              <YAxis type="category" dataKey="categoria" tick={{ fontSize: 11 }} width={120} />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Total']}
              />
              <Bar dataKey="total" radius={[0, 5, 5, 0]}>
                {rankingData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
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

            {analise.resumo_executivo && (
              <div style={styles.secao}>
                <div style={styles.secaoTitulo}>Resumo</div>
                <p style={styles.secaoTexto}>{analise.resumo_executivo}</p>
              </div>
            )}

            {analise.pontos_de_atencao && analise.pontos_de_atencao.length > 0 && (
              <div style={styles.secao}>
                <div style={styles.secaoTitulo}>Pontos de Atenção</div>
                <ul style={styles.lista}>
                  {analise.pontos_de_atencao.map((p, i) => (
                    <li key={i} style={styles.listaItem}>⚠️ {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {analise.maiores_gastos_analise && analise.maiores_gastos_analise.length > 0 && (
              <div style={styles.secao}>
                <div style={styles.secaoTitulo}>Análise dos Maiores Gastos</div>
                <ul style={styles.lista}>
                  {analise.maiores_gastos_analise.map((g, i) => (
                    <li key={i} style={styles.listaItem}>📊 {g}</li>
                  ))}
                </ul>
              </div>
            )}

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
              {analise.meta_poupanca_sugerida && (
                <div style={styles.metaBox}>
                  <div style={styles.metaLabel}>Meta de Poupança Sugerida</div>
                  <div style={styles.metaValor}>{analise.meta_poupanca_sugerida}</div>
                </div>
              )}

              {analise.distribuicao_ideal && Object.keys(analise.distribuicao_ideal).length > 0 && (
                <div style={styles.distBox}>
                  <div style={styles.metaLabel}>Distribuição Ideal da Renda</div>
                  <div style={styles.distGrid}>
                    {Object.entries(analise.distribuicao_ideal).map(([cat, pct], i) => (
                      <div key={i} style={styles.distItem}>
                        <span style={{ color: COLORS[i % COLORS.length], fontWeight: 700 }}>{pct}</span>
                        <span style={styles.distCat}>{cat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {analise.gerado_em && (
              <div style={styles.geradoEm}>
                Gerado em {new Date(analise.gerado_em).toLocaleString('pt-BR')}
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
  wrapper: { display: 'flex', flexDirection: 'column', gap: 20 },
  loading: { padding: 32, textAlign: 'center', color: 'var(--color-text-light)' },
  empty: {
    padding: 24, textAlign: 'center', color: 'var(--color-text-light)',
    background: 'var(--color-primary-light)', borderRadius: 8,
  },
  kpiRow: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  kpi: {
    flex: 1, minWidth: 140,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)', padding: '14px 18px',
  },
  kpiLabel: { fontSize: '0.72rem', color: 'var(--color-text-light)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)' },

  chartCard: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)', padding: '16px 20px',
  },
  chartTitle: { margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-dark)' },

  // Pie chart layout
  pieRow: { display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' },
  pieLegend: {
    flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 5,
    maxHeight: 300, overflowY: 'auto', paddingRight: 4,
  },
  pieLegendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' },
  pieDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  pieCatName: { flex: 1, color: 'var(--color-text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  pieCatPct: { color: 'var(--color-text-light)', width: 36, textAlign: 'right', flexShrink: 0 },
  pieCatVal: { color: 'var(--color-primary)', fontWeight: 600, width: 90, textAlign: 'right', flexShrink: 0, fontSize: '0.8rem' },

  // Ranking com filtro
  rankingHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 },
  rankingFiltros: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filtro: {
    border: '1px solid var(--color-border)', background: 'transparent',
    borderRadius: 20, padding: '3px 10px', fontSize: '0.78rem',
    cursor: 'pointer', color: 'var(--color-text-light)',
  },
  filtroAtivo: {
    border: '1px solid var(--color-primary)', background: 'var(--color-primary)',
    borderRadius: 20, padding: '3px 10px', fontSize: '0.78rem',
    cursor: 'pointer', color: '#fff', fontWeight: 600,
  },

  // Alerta Outros
  outrosAlert: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8,
    padding: '10px 16px', fontSize: '0.85rem', color: '#9A3412', flexWrap: 'wrap',
  },
  btnSmall: {
    background: 'var(--color-primary)', color: '#fff', border: 'none',
    borderRadius: 6, padding: '6px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnSmallDisabled: {
    background: 'var(--color-border)', color: 'var(--color-text-light)', border: 'none',
    borderRadius: 6, padding: '6px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'not-allowed',
    whiteSpace: 'nowrap',
  },

  // Análise IA
  analiseCard: {
    background: 'var(--color-surface)', border: '2px solid var(--color-primary)',
    borderRadius: 'var(--border-radius)', padding: '20px 22px',
  },
  analiseHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 },
  analiseSubtitle: { margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-text-light)' },
  btn: {
    background: 'var(--color-primary)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: '0.88rem',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnDisabled: {
    background: 'var(--color-border)', color: 'var(--color-text-light)', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: '0.88rem',
    cursor: 'not-allowed', whiteSpace: 'nowrap',
  },
  erroBox: {
    marginTop: 12, padding: '10px 14px', background: '#FEE2E2',
    border: '1px solid #FCA5A5', borderRadius: 6, color: '#DC2626', fontSize: '0.85rem',
  },
  analiseBody: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 },
  notaBox: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--color-background)', borderRadius: 8, padding: '12px 16px',
  },
  notaLabel: { fontSize: '0.85rem', color: 'var(--color-text-light)' },
  notaValor: { fontSize: '2rem', fontWeight: 900 },
  secao: {},
  secaoTitulo: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  secaoTexto: { margin: 0, lineHeight: 1.6, color: 'var(--color-text-dark)', fontSize: '0.9rem' },
  lista: { margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  listaNum: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 },
  listaItem: { fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--color-text-dark)' },
  analiseRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  metaBox: {
    flex: 1, minWidth: 200, background: '#EFF6FF', border: '1px solid #BFDBFE',
    borderRadius: 8, padding: '12px 16px',
  },
  metaLabel: { fontSize: '0.78rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  metaValor: { fontSize: '0.95rem', color: '#1E40AF', fontWeight: 600 },
  distBox: {
    flex: 2, minWidth: 260, background: 'var(--color-background)',
    border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px',
  },
  distGrid: { display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginTop: 4 },
  distItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' },
  distCat: { color: 'var(--color-text-dark)' },
  geradoEm: { fontSize: '0.72rem', color: 'var(--color-text-light)', textAlign: 'right', marginTop: 4 },

  // Faturas abertas
  abertas: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)', padding: '16px 20px',
  },
  abertasGrid: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 },
  abertaCard: {
    minWidth: 160, background: '#FFF3E0', border: '1px solid #FF9800',
    borderRadius: 8, padding: '12px 14px',
  },
  abertaNome: { fontWeight: 700, fontSize: '0.9rem', color: '#E65100', marginBottom: 2 },
  abertaMes: { fontSize: '0.75rem', color: '#BF360C', marginBottom: 4 },
  abertaVenc: { fontSize: '0.75rem', color: 'var(--color-text-light)', marginBottom: 6 },
  abertaValor: { fontSize: '1.1rem', fontWeight: 700, color: '#E53935' },
};
