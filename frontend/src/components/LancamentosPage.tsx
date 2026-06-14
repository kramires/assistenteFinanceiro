import React, { useState } from 'react';
import LancamentoIA from './LancamentoIA';
import TransactionForm from './TransactionForm';
import UploadExtrato from './UploadExtrato';
import UploadNota from './UploadNota';

type MetodoLancamento = 'ia' | 'manual' | 'upload';

interface Props {
  ano: number;
  onActionComplete: () => void;
}

const LancamentosPage: React.FC<Props> = ({ ano, onActionComplete }) => {
  const [metodoAtivo, setMetodoAtivo] = useState<MetodoLancamento>('ia');

  const SubTabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
    <button onClick={onClick} style={isActive ? styles.subTabActive : styles.subTab}>
      {label}
    </button>
  );

  return (
    <div style={styles.container}>
      <div style={styles.subTabsContainer}>
        <SubTabButton label="Lançamento por IA" isActive={metodoAtivo === 'ia'} onClick={() => setMetodoAtivo('ia')} />
        <SubTabButton label="Lançamento Manual" isActive={metodoAtivo === 'manual'} onClick={() => setMetodoAtivo('manual')} />
        <SubTabButton label="Importar Arquivos" isActive={metodoAtivo === 'upload'} onClick={() => setMetodoAtivo('upload')} />
      </div>

      <div style={styles.content}>
        {metodoAtivo === 'ia' && <LancamentoIA onLancamentoFeito={onActionComplete} />}
        
        {metodoAtivo === 'manual' && <TransactionForm onTransactionCreated={onActionComplete} />}

        {metodoAtivo === 'upload' && (
          <div style={styles.uploadCard}>
            <h2 style={styles.uploadTitle}>Importar Transações ({ano})</h2>
            <p style={styles.uploadSubtitle}>
              Faça o upload de extratos bancários ou notas fiscais para adicionar múltiplas transações de uma vez.
            </p>
            <div style={styles.uploadButtonsContainer}>
              <UploadExtrato onUpload={onActionComplete} />
              <UploadNota onUpload={onActionComplete} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '700px',
    margin: '0 auto',
  },
  subTabsContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '32px',
  },
  subTab: {
    padding: '10px 20px',
    fontSize: '1rem',
    fontWeight: 500,
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--color-text-light)',
    cursor: 'pointer',
  },
  subTabActive: {
    padding: '10px 20px',
    fontSize: '1rem',
    fontWeight: 600,
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid var(--color-primary)',
    color: 'var(--color-primary)',
    cursor: 'pointer',
  },
  content: {
    // O conteúdo de cada aba já tem seu próprio card/estilo
  },
  uploadCard: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius)',
    padding: '32px',
    boxShadow: 'var(--box-shadow)',
    textAlign: 'center'
  },
  uploadTitle: {
    marginTop: 0,
    marginBottom: '8px'
  },
  uploadSubtitle: {
    color: 'var(--color-text-light)',
    marginTop: 0,
    marginBottom: '32px',
    maxWidth: '450px',
    marginLeft: 'auto',
    marginRight: 'auto'
  },
  uploadButtonsContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    flexWrap: 'wrap'
  }
};

export default LancamentosPage;
