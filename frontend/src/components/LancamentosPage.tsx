import React, { useEffect, useState } from 'react';
import AnaliseIA from './AnaliseIA';
import LancamentoIA from './LancamentoIA';
import TransactionForm from './TransactionForm';
import UploadExtrato from './UploadExtrato';
import UploadNota from './UploadNota';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

type MetodoLancamento = 'ia' | 'manual' | 'upload' | 'analise';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  ano: number;
  onActionComplete: () => void;
}

const LancamentosPage: React.FC<Props> = ({ ano, onActionComplete }) => {
  const [metodoAtivo, setMetodoAtivo] = useState<MetodoLancamento>('ia');
  const [mesAnalise, setMesAnalise] = useState<number | null>(new Date().getMonth() + 1);
  const [categoriaAnalise, setCategoriaAnalise] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    if (metodoAtivo !== 'analise' || categorias.length > 0) return;
    apiFetch(`${API_BASE}/categorias`)
      .then(res => res.json())
      .then((data: { nome: string }[]) => {
        if (Array.isArray(data)) setCategorias(data.map(c => c.nome).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      })
      .catch(() => { /* sem lista: analisa todas as categorias */ });
  }, [metodoAtivo, categorias.length]);

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
        <SubTabButton label="Analisar com IA" isActive={metodoAtivo === 'analise'} onClick={() => setMetodoAtivo('analise')} />
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

        {metodoAtivo === 'analise' && (
          <>
            <div style={styles.filtros}>
              <label style={styles.filtro}>
                <span style={styles.filtroLabel}>Período ({ano})</span>
                <select
                  value={mesAnalise ?? ''}
                  onChange={e => setMesAnalise(e.target.value ? Number(e.target.value) : null)}
                  style={styles.filtroSelect}
                >
                  <option value="">Ano inteiro</option>
                  {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
                </select>
              </label>
              <label style={styles.filtro}>
                <span style={styles.filtroLabel}>Categoria</span>
                <select
                  value={categoriaAnalise ?? ''}
                  onChange={e => setCategoriaAnalise(e.target.value || null)}
                  style={styles.filtroSelect}
                >
                  <option value="">Todas</option>
                  {categorias.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                  <option value="Sem categoria">Sem categoria</option>
                </select>
              </label>
            </div>
            <AnaliseIA ano={ano} mes={mesAnalise} categoria={categoriaAnalise} />
          </>
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
    flexWrap: 'wrap',
    gap: '8px 16px',
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
  filtros: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
  filtro: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1 1 200px',
  },
  filtroLabel: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--color-text-light)',
  },
  filtroSelect: {
    padding: '8px 10px',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
    fontSize: '0.95rem',
  },
  uploadButtonsContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    flexWrap: 'wrap'
  }
};

export default LancamentosPage;
