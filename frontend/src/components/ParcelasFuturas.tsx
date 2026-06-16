import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface MesData {
  mes: string;
  total: number;
  por_cartao: { cartao: string; total: number }[];
}

const COLORS = ['#6C63FF', '#FF6584', '#43CFFF', '#FFB347', '#98D8C8', '#FF8B94'];

export default function ParcelasFuturas() {
  const [dados, setDados] = useState<MesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartoes, setCartoes] = useState<string[]>([]);

  useEffect(() => {
    apiFetch(`${API_BASE}/faturas/parcelas-futuras?meses=6`)
      .then(r => r.json())
      .then((data: MesData[]) => {
        setDados(data);
        const nomes = new Set<string>();
        data.forEach(m => m.por_cartao.forEach(c => nomes.add(c.cartao)));
        setCartoes(Array.from(nomes));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loading}>Carregando parcelas futuras...</div>;

  if (dados.every(m => m.total === 0)) {
    return (
      <div style={styles.empty}>
        Nenhuma parcela futura detectada. Importe faturas com compras parceladas para visualizar aqui.
      </div>
    );
  }

  const chartData = dados.map(m => {
    const row: Record<string, string | number> = { mes: fmtMes(m.mes) };
    m.por_cartao.forEach(c => { row[c.cartao] = c.total; });
    return row;
  });

  const totalGeral = dados.reduce((s, m) => s + m.total, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Parcelas Futuras</h3>
        <span style={styles.subtitle}>
          Total projetado: R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(v: number, name: string) => [
              `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              name,
            ]}
          />
          <Legend />
          {cartoes.map((c, i) => (
            <Bar key={c} dataKey={c} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === cartoes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div style={styles.table}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={styles.th}>Mês</th>
              {cartoes.map(c => <th key={c} style={styles.th}>{c}</th>)}
              <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {dados.map(m => (
              <tr key={m.mes} style={styles.tr}>
                <td style={styles.td}>{fmtMes(m.mes)}</td>
                {cartoes.map(c => {
                  const val = m.por_cartao.find(p => p.cartao === c)?.total || 0;
                  return (
                    <td key={c} style={styles.td}>
                      {val > 0 ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                  );
                })}
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>
                  R$ {m.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtMes(mes: string): string {
  const [ano, m] = mes.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(m) - 1]}/${ano.slice(2)}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
    padding: '20px 24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  title: { margin: 0, fontSize: '1.1rem', color: 'var(--color-text-dark)' },
  subtitle: { fontSize: '0.9rem', color: 'var(--color-text-light)' },
  loading: { padding: 32, textAlign: 'center', color: 'var(--color-text-light)' },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--color-text-light)',
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
  },
  table: { marginTop: 20, overflowX: 'auto' },
  th: {
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-light)',
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--color-border)',
  },
  tr: { borderBottom: '1px solid var(--color-border)' },
  td: { padding: '8px 12px', fontSize: '0.85rem' },
};
