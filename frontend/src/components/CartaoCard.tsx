import React from 'react';

interface Props {
  id: number;
  nome: string;
  bandeira?: string | null;
  final_numero?: string | null;
  limite?: number | null;
  cor: string;
  valorFatura?: number;
  dataVencimento?: string | null;
  status?: string;
  isSelected: boolean;
  onClick: () => void;
}

export default function CartaoCard({
  nome, bandeira, final_numero, cor, valorFatura, dataVencimento, status, isSelected, onClick,
}: Props) {
  const isPaid = status === 'paga';
  const venc = dataVencimento ? new Date(dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR') : null;

  return (
    <div
      onClick={onClick}
      style={{
        ...styles.card,
        background: `linear-gradient(135deg, ${cor} 0%, ${darken(cor, 30)} 100%)`,
        border: isSelected ? '3px solid #fff' : '3px solid transparent',
        boxShadow: isSelected ? `0 0 0 3px ${cor}, 0 8px 24px rgba(0,0,0,0.2)` : '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <div style={styles.cardHeader}>
        <span style={styles.cardNome}>{nome}</span>
        {bandeira && <span style={styles.bandeira}>{bandeira.toUpperCase()}</span>}
      </div>

      {final_numero && (
        <div style={styles.cardNumber}>•••• •••• •••• {final_numero}</div>
      )}

      <div style={styles.cardFooter}>
        <div>
          {valorFatura !== undefined && (
            <>
              <div style={styles.label}>Fatura atual</div>
              <div style={styles.valor}>
                R$ {valorFatura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {venc && (
            <>
              <div style={styles.label}>Vencimento</div>
              <div style={styles.venc}>{venc}</div>
            </>
          )}
          {isPaid && <span style={styles.paidBadge}>PAGA</span>}
        </div>
      </div>
    </div>
  );
}

function darken(hex: string, amount: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch {
    return hex;
  }
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    width: 260,
    minHeight: 150,
    borderRadius: 16,
    padding: '18px 20px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'transform 0.15s, box-shadow 0.15s',
    flexShrink: 0,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardNome: {
    fontWeight: 700,
    fontSize: '1rem',
  },
  bandeira: {
    fontSize: '0.65rem',
    fontWeight: 700,
    opacity: 0.85,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    padding: '2px 6px',
  },
  cardNumber: {
    fontSize: '0.85rem',
    opacity: 0.75,
    letterSpacing: 2,
    margin: '12px 0',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    fontSize: '0.65rem',
    opacity: 0.75,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  valor: {
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  venc: {
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  paidBadge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
    padding: '2px 6px',
    letterSpacing: 1,
  },
};
