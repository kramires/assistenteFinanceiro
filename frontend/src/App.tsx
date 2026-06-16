import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import CardResumoMes from './components/CardResumoMes';
import CategoryList from './components/CategoryList';
import LancamentosPage from './components/LancamentosPage';
import BudgetList from './components/BudgetList';
import BudgetForm from './components/BudgetForm';
import UberPage from './components/UberPage';
import CartoesPage from './components/CartoesPage';
import PerfilModal from './components/PerfilModal';
import LoginPage from './auth/LoginPage';

import './App.css';
import { API_BASE } from './config';
import { apiFetch, clearToken, getToken } from './api';

function getUsernameFromToken(): string {
  const token = getToken();
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || '';
  } catch {
    return '';
  }
}

// --- Constantes e Tipos ---
const currentYear = new Date().getFullYear();
const anosDisponiveis: number[] = [];
for (let y = 2023; y <= currentYear + 1; y++) {
  anosDisponiveis.push(y);
}
const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type Aba = 'visualizacao' | 'lancamento' | 'uber' | 'categorias' | 'cartoes';

interface GastoCategoria { categoria: string; total: number; }
interface EvolucaoMensal { mes: string; total: number; }
interface ResumoMesAnual { mes: string; receitas: number; despesas: number; saldo: number; saldo_acumulado: number; }
interface Categoria { id: number; nome: string; tipo: string; }

// --- Componente Principal ---
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => !!getToken());
  const [refresh, setRefresh] = useState(false);
  const [anoSelecionado, setAnoSelecionado] = useState<number>(currentYear);
  const [mesSelecionado, setMesSelecionado] = useState<number>(new Date().getMonth() + 1);
  const [abaAtiva, setAbaAtiva] = useState<Aba>('visualizacao');

  const [gastosCategoria, setGastosCategoria] = useState<GastoCategoria[]>([]);
  const [evolucaoMensal, setEvolucaoMensal] = useState<EvolucaoMensal[]>([]);
  const [resumoAnual, setResumoAnual] = useState<ResumoMesAnual[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);

  const refreshAll = () => setRefresh(r => !r);

  useEffect(() => {
    const handleUnauthorized = () => { setIsLoggedIn(false); };
    window.addEventListener('af:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('af:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = () => { clearToken(); setIsLoggedIn(false); };

  const handleFetchError = (err: unknown) => {
    if (err instanceof TypeError && (err.message === 'Failed to fetch' || err.message?.includes('fetch'))) {
      setBackendUnavailable(true);
    }
  };

  useEffect(() => {
    if (abaAtiva === 'visualizacao') {
      setBackendUnavailable(false);
      Promise.all([
        apiFetch(`${API_BASE}/dashboard/gastos-por-categoria?ano=${anoSelecionado}&mes=${mesSelecionado}`).then(res => res.json()).then(data => Array.isArray(data) && setGastosCategoria(data)),
        apiFetch(`${API_BASE}/dashboard/evolucao-mensal?ano=${anoSelecionado}`).then(res => res.json()).then(data => Array.isArray(data) && setEvolucaoMensal(data)),
        apiFetch(`${API_BASE}/dashboard/resumo-anual?ano=${anoSelecionado}`).then(res => res.json()).then(data => Array.isArray(data) && setResumoAnual(data)),
        apiFetch(`${API_BASE}/dashboard/alertas?ano=${anoSelecionado}&mes=${mesSelecionado}`).then(res => res.json()).then((data: { alertas: string[] }) => setAlertas(Array.isArray(data?.alertas) ? data.alertas : [])),
        apiFetch(`${API_BASE}/categorias`).then(res => res.json()).then(data => Array.isArray(data) && setCategorias(data)),
      ]).catch(handleFetchError);
    }
  }, [anoSelecionado, mesSelecionado, abaAtiva, refresh]);

  const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
    <button onClick={onClick} style={isActive ? styles.tabButtonActive : styles.tabButton}>{label}</button>
  );

  const MonthButton: React.FC<{ label: string; month: number; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
    <button onClick={onClick} style={isActive ? styles.monthButtonActive : styles.monthButton}>{label}</button>
  );

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div style={styles.appContainer}>
      {perfilAberto && (
        <PerfilModal username={getUsernameFromToken()} onClose={() => setPerfilAberto(false)} />
      )}
      {backendUnavailable && (
        <div style={styles.backendBanner}>
          <strong>Backend não disponível.</strong> Inicie o servidor com:{' '}
          <code style={styles.backendCode}>uvicorn backend.app.main:app --reload --port 8002</code>
        </div>
      )}
      <header style={styles.header}>
        <h1 style={{ marginBottom: 0 }}>Assistente Financeiro</h1>
        <div style={styles.yearSelectorContainer}>
          <label htmlFor="year-select">Ano:</label>
          <select id="year-select" value={anoSelecionado} onChange={e => setAnoSelecionado(Number(e.target.value))} style={styles.yearSelect}>
            {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
          <button onClick={() => setPerfilAberto(true)} style={styles.logoutBtn}>Perfil</button>
          <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
        </div>
      </header>

      <div style={styles.tabsContainer}>
        <TabButton label="Visualização" isActive={abaAtiva === 'visualizacao'} onClick={() => setAbaAtiva('visualizacao')} />
        <TabButton label="Movimentações" isActive={abaAtiva === 'lancamento'} onClick={() => setAbaAtiva('lancamento')} />
        <TabButton label="Transporte por Aplicativo" isActive={abaAtiva === 'uber'} onClick={() => setAbaAtiva('uber')} />
        <TabButton label="Categorias" isActive={abaAtiva === 'categorias'} onClick={() => setAbaAtiva('categorias')} />
        <TabButton label="Cartões" isActive={abaAtiva === 'cartoes'} onClick={() => setAbaAtiva('cartoes')} />
      </div>

      {(abaAtiva === 'visualizacao' || abaAtiva === 'uber') && (
        <div style={styles.monthsContainer}>
          {nomesMeses.map((mesNome, idx) => (
            <MonthButton key={idx + 1} label={mesNome} month={idx + 1} isActive={mesSelecionado === (idx + 1)} onClick={() => setMesSelecionado(idx + 1)} />
          ))}
        </div>
      )}

      <main>
        {abaAtiva === 'visualizacao' && (
          <div style={styles.visualizacaoContainer}>
            <div style={styles.mainColumn}>
              <CardResumoMes ano={anoSelecionado} mes={mesSelecionado} />
              {alertas.length > 0 && (
                <div style={styles.alertasCard}>
                  <h3 style={styles.alertasTitle}>Alertas</h3>
                  <ul style={styles.alertasList}>
                    {alertas.map((msg, i) => (
                      <li key={i} style={styles.alertasItem}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Dashboard gastosCategoria={gastosCategoria} evolucaoMensal={evolucaoMensal} resumoAnual={resumoAnual} ano={anoSelecionado} />
              <TransactionList refreshFlag={refresh} ano={anoSelecionado} mes={mesSelecionado} />
            </div>
            <aside style={styles.sidebarColumn}>
              <BudgetForm ano={anoSelecionado} mes={mesSelecionado} onOrcamentoSalvo={refreshAll} />
              <BudgetList ano={anoSelecionado} mes={mesSelecionado} gastosPorCategoria={gastosCategoria} categorias={categorias} onChange={refreshAll} />
            </aside>
          </div>
        )}
        {abaAtiva === 'lancamento' && (
          <LancamentosPage ano={anoSelecionado} onActionComplete={refreshAll} />
        )}
        {abaAtiva === 'uber' && (
          <UberPage ano={anoSelecionado} mes={mesSelecionado} />
        )}
        {abaAtiva === 'categorias' && (
          <CategoryList />
        )}
        {abaAtiva === 'cartoes' && (
          <CartoesPage />
        )}
      </main>
    </div>
  );
}

// --- Estilos CSS-in-JS (Completo) ---
const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    maxWidth: 1200,
    margin: '32px auto',
    padding: '24px 32px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--box-shadow)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  yearSelectorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '1rem',
  },
  yearSelect: {
    fontSize: '1rem',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
  },
  logoutBtn: {
    padding: '4px 12px',
    fontSize: '0.9rem',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--color-text-light)',
  },
  tabsContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: '12px',
  },
  tabButton: {
    padding: '10px 20px',
    borderRadius: 'var(--border-radius)',
    border: 'none',
    background: 'transparent',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '1rem',
    color: 'var(--color-text-light)',
  },
  tabButtonActive: {
    padding: '10px 20px',
    borderRadius: 'var(--border-radius)',
    border: 'none',
    background: 'var(--color-primary-light)',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '1rem',
    color: 'var(--color-primary)',
  },
  monthsContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  monthButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    fontWeight: 500,
    color: 'var(--color-text-dark)',
    cursor: 'pointer',
  },
  monthButtonActive: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '2px solid var(--color-primary)',
    background: 'var(--color-primary-light)',
    fontWeight: 'bold',
    color: 'var(--color-primary)',
    cursor: 'pointer',
  },
  visualizacaoContainer: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '24px',
    alignItems: 'start'
  },
  mainColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  sidebarColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'sticky',
    top: '24px'
  },
  alertasCard: {
    background: '#FFF8E1',
    border: '1px solid #FFC107',
    borderRadius: 'var(--border-radius)',
    padding: '16px 20px',
  },
  alertasTitle: {
    margin: '0 0 12px 0',
    fontSize: '1rem',
    color: 'var(--color-text-dark)',
  },
  alertasList: {
    margin: 0,
    paddingLeft: '20px',
  },
  alertasItem: {
    marginBottom: '6px',
    fontSize: '0.9rem',
    color: 'var(--color-text-dark)',
  },
  backendBanner: {
    background: '#FFEBEE',
    border: '1px solid #EF5350',
    borderRadius: 'var(--border-radius)',
    padding: '12px 16px',
    marginBottom: '16px',
    fontSize: '0.9rem',
    color: 'var(--color-text-dark)',
  },
  backendCode: {
    background: 'rgba(0,0,0,0.06)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '0.85em',
  },
};

export default App;
