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
  
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  type Tom = 'success' | 'error' | 'primary' | 'accent' | 'neutro';

  const Metric: React.FC<{
    title: string;
    icon: string;
    tom: Tom;
    children: React.ReactNode;
    hero?: boolean;
  }> = ({ title, icon, tom, children, hero }) => (
    <div
      className={hero ? 'metric-card metric-hero' : 'metric-card'}
      style={hero ? undefined : styles.metricCard}
    >
      <div className="metric-title">
        <span className={`metric-icon tom-${tom}`} aria-hidden="true">{icon}</span>
        <span style={styles.metricTitleText}>{title}</span>
      </div>
      {children}
    </div>
  );

  const Valor: React.FC<{ value: string; color?: string; large?: boolean }> = ({ value, color, large }) => (
    <div
      className="metric-value"
      style={{ color, ['--metric-max' as string]: large ? '1.7rem' : '1.3rem' }}
      title={value}
    >
      {value}
    </div>
  );

  const corSinal = (v: number) => (v >= 0 ? 'var(--color-success)' : 'var(--color-error)');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
          <div style={styles.periodTitle}>{nomesMeses[mes-1]} / {ano}</div>
          <div style={styles.periodSubtitle}>Período atual</div>
      </div>
      <div style={styles.metricsGrid}>
        <Metric title="Saldo do Mês" icon="◎" tom="primary" hero>
          <Valor value={brl(resumo.saldo)} large />
        </Metric>
        <Metric title="Receitas" icon="↑" tom="success">
          <Valor value={brl(resumo.receitas)} color="var(--color-success)" large />
        </Metric>
        <Metric title="Despesas" icon="↓" tom="error">
          <Valor value={brl(resumo.despesas)} color="var(--color-error)" large />
        </Metric>
        <Metric title="Comparação Mês Anterior" icon={positivo ? '▲' : '▼'} tom={positivo ? 'success' : 'error'}>
          <Valor value={brl(Math.abs(diferenca))} color={corSinal(diferenca)} />
        </Metric>
        <Metric title="Saldo Acumulado Ano" icon="Σ" tom="accent">
          <Valor value={brl(resumo.saldo_acumulado)} color={corSinal(resumo.saldo_acumulado)} />
        </Metric>
        <Metric title="Média de Gastos Mensal" icon="≈" tom="neutro">
          <Valor value={brl(resumo.media_mensal)} color="var(--color-text-dark)" />
        </Metric>
        <Metric title="Maior Gasto do Mês" icon="!" tom="error">
            {resumo.maior_gasto.descricao ? (
                <div>
                    <div style={styles.maiorGastoDesc}>{resumo.maior_gasto.descricao}</div>
                    <div style={styles.maiorGastoValor}>{resumo.maior_gasto.valor != null ? brl(resumo.maior_gasto.valor) : ''}</div>
                </div>
            ) : (
                <div style={{ color: 'var(--color-text-light)' }}>Nenhum gasto</div>
            )}
        </Metric>
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
    metricTitleText: {
        minWidth: 0,
        lineHeight: 1.25,
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
