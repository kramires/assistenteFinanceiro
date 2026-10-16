import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface MaiorGasto {
  descricao: string | null;
  valor: number | null;
}

interface ResumoMes {
  receitas: number;
  despesas: number;
  saldo: number;
  saldo_acumulado: number;
  media_mensal: number;
  saldo_mes_anterior: number;
  maior_gasto: MaiorGasto;
}

interface Props {
  ano: number;
  mes: number;
}

const nomesMeses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const CardResumoMes: React.FC<Props> = ({ ano, mes }) => {
  const [resumo, setResumo] = useState<ResumoMes | null>(null);
  const [resumoNarrativo, setResumoNarrativo] = useState<string | null>(null);
  const [resumoNarrativoErro, setResumoNarrativoErro] = useState<string | null>(null);
  const [gerandoNarrativo, setGerandoNarrativo] = useState(false);

  useEffect(() => {
    apiFetch(`${API_BASE}/dashboard/resumo-mes?ano=${ano}&mes=${mes}`)
      .then(res => res.json())
      .then(data => setResumo(data));
  }, [ano, mes]);

  const gerarResumoNarrativo = () => {
    setGerandoNarrativo(true);
    setResumoNarrativo(null);
    setResumoNarrativoErro(null);
    apiFetch(`${API_BASE}/dashboard/resumo-narrativo?ano=${ano}&mes=${mes}`)
      .then(res => res.json())
      .then((data: { texto?: string; erro?: string }) => {
        if (data.texto) setResumoNarrativo(data.texto);
        if (data.erro) setResumoNarrativoErro(data.erro);
      })
      .catch(() => setResumoNarrativoErro('Falha ao conectar com o servidor.'))
      .finally(() => setGerandoNarrativo(false));
  };

  if (!resumo) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} aria-hidden />
        <p style={styles.loadingText}>Carregando resumo do mês...</p>
      </div>
    );
  }

  // Comparação com o mês anterior
  const diferenca = resumo.saldo - resumo.saldo_mes_anterior;
  const positivo = diferenca >= 0;
  
  const Metric: React.FC<{ title: string; value: string; color?: string; size?: 'normal' | 'large' }> = ({ title, value, color, size = 'normal' }) => (
      <div className="metric-card" style={styles.metricCard}>
        <div style={styles.metricTitle}>{title}</div>
        <div
          className="metric-value"
          style={{ color: color || 'var(--color-text-dark)', ['--metric-max' as string]: size === 'large' ? '1.7rem' : '1.3rem' }}
          title={value}
        >
          {value}
        </div>
      </div>
    );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
          <div style={styles.periodTitle}>{nomesMeses[mes-1]} / {ano}</div>
          <div style={styles.periodSubtitle}>Período atual</div>
      </div>
      <div style={styles.metricsGrid}>
        <Metric title="Receitas" value={resumo.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color="var(--color-success)" size="large" />
        <Metric title="Despesas" value={resumo.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color="var(--color-error)" size="large" />
        <Metric title="Saldo do Mês" value={resumo.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color={resumo.saldo >= 0 ? 'var(--color-success)' : 'var(--color-error)'} size="large" />
        
        <div className="metric-card" style={styles.metricCard}>
            <div style={styles.metricTitle}>Comparação Mês Anterior</div>
            <div className="metric-value" style={{ color: positivo ? 'var(--color-success)' : 'var(--color-error)', ['--metric-max' as string]: '1.3rem' }}>
                {positivo ? '▲' : '▼'} {Math.abs(diferenca).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
        </div>

        <Metric title="Saldo Acumulado Ano" value={resumo.saldo_acumulado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color={resumo.saldo_acumulado >= 0 ? 'var(--color-primary)' : 'var(--color-error)'} />
        <Metric title="Média de Gastos Mensal" value={resumo.media_mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
        
        <div className="metric-card" style={styles.metricCard}>
            <div style={styles.metricTitle}>Maior Gasto do Mês</div>
            {resumo.maior_gasto.descricao ? (
                <div>
                    <div style={styles.maiorGastoDesc}>{resumo.maior_gasto.descricao}</div>
                    <div style={styles.maiorGastoValor}>{resumo.maior_gasto.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
            ) : (
                <div style={{ color: 'var(--color-text-light)' }}>Nenhum gasto</div>
            )}
        </div>
      </div>

      <div style={styles.resumoNarrativoSection}>
        <div style={styles.resumoNarrativoTitle}>Resumo com IA</div>
        <button
          type="button"
          onClick={gerarResumoNarrativo}
          disabled={gerandoNarrativo}
          style={styles.resumoNarrativoBtn}
        >
          {gerandoNarrativo ? 'Gerando...' : 'Gerar resumo do mês'}
        </button>
        {resumoNarrativo && <p style={styles.resumoNarrativoText}>{resumoNarrativo}</p>}
        {resumoNarrativoErro && <p style={styles.resumoNarrativoErro}>{resumoNarrativoErro}</p>}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
    loading: { padding: '20px', fontWeight: 500 },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '48px 24px',
      background: 'var(--color-surface-muted)',
      borderRadius: 'var(--border-radius)',
      border: '1px solid var(--color-border)',
      minHeight: '120px',
    },
    spinner: {
      width: 32,
      height: 32,
      border: '3px solid var(--color-border)',
      borderTopColor: 'var(--color-primary)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
    loadingText: {
      margin: 0,
      fontSize: '0.95rem',
      color: 'var(--color-text-light)',
      fontWeight: 500,
    },
    container: {
        background: 'var(--color-surface-muted)',
        borderRadius: 'var(--border-radius)',
        padding: 'clamp(14px, 3vw, 24px)',
        border: '1px solid var(--color-border)'
    },
    header: {
        marginBottom: '16px'
    },
    periodTitle: {
        fontWeight: 'bold',
        fontSize: '1.2rem',
    },
    periodSubtitle: {
        fontSize: '0.9rem',
        color: 'var(--color-text-light)'
    },
    metricsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
    },
    metricCard: {
        background: 'var(--color-surface)',
        padding: '14px',
        minWidth: 0,
        borderRadius: 'var(--border-radius)',
        border: '1px solid var(--color-border)'
    },
    metricTitle: {
        fontWeight: 500,
        color: 'var(--color-text-light)',
        fontSize: '0.9rem',
        marginBottom: '8px'
    },
    maiorGastoDesc: {
        fontSize: '1rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    maiorGastoValor: {
        color: 'var(--color-error)',
        fontWeight: 600
    },
    resumoNarrativoSection: {
      marginTop: '24px',
      paddingTop: '20px',
      borderTop: '1px solid var(--color-border)',
    },
    resumoNarrativoTitle: {
      fontWeight: 600,
      fontSize: '1rem',
      color: 'var(--color-text-dark)',
      marginBottom: '10px',
    },
    resumoNarrativoBtn: {
      padding: '8px 16px',
      borderRadius: 'var(--border-radius)',
      border: '1px solid var(--color-primary)',
      background: 'var(--color-primary-light)',
      color: 'var(--color-primary)',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem',
    },
    resumoNarrativoText: {
      marginTop: '12px',
      marginBottom: 0,
      fontSize: '0.95rem',
      lineHeight: 1.5,
      color: 'var(--color-text-dark)',
    },
    resumoNarrativoErro: {
      marginTop: '12px',
      marginBottom: 0,
      fontSize: '0.9rem',
      color: 'var(--color-error)',
    },
};

export default CardResumoMes;
