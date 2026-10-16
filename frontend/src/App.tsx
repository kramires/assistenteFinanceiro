import React, { useState, useEffect, useRef } from 'react';
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
type Tema = 'light' | 'dark';

const TEMA_KEY = 'af_tema';

function temaInicial(): Tema {
  try {
    const salvo = localStorage.getItem(TEMA_KEY);
    if (salvo === 'light' || salvo === 'dark') return salvo;
  } catch {
    // localStorage indisponível (aba anônima): segue o sistema
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const ABAS: { id: Aba; label: string }[] = [
  { id: 'visualizacao', label: 'Visão geral' },
  { id: 'lancamento', label: 'Movimentações' },
  { id: 'uber', label: 'Transporte' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'cartoes', label: 'Cartões' },
];

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
  const [tema, setTema] = useState<Tema>(temaInicial);
  const mesesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try { localStorage.setItem(TEMA_KEY, tema); } catch { /* ignora */ }
  }, [tema]);

  const refreshAll = () => setRefresh(r => !r);

  // No celular a faixa de meses rola na horizontal: centraliza o mês ativo
  useEffect(() => {
    const faixa = mesesRef.current;
    const ativo = faixa?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (faixa && ativo) {
      faixa.scrollLeft = ativo.offsetLeft - faixa.offsetLeft - (faixa.clientWidth - ativo.offsetWidth) / 2;
    }
  }, [mesSelecionado, abaAtiva, isLoggedIn]);

  useEffect(() => {
    const handleUnauthorized = () => { setIsLoggedIn(false); };
    window.addEventListener('af:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('af:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // ignora erro de rede — limpa token de qualquer forma
    }
    clearToken();
    setIsLoggedIn(false);
  };

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

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="app">
      {perfilAberto && (
        <PerfilModal username={getUsernameFromToken()} onClose={() => setPerfilAberto(false)} />
      )}
      {backendUnavailable && (
        <div className="aviso aviso-erro" style={{ marginBottom: 16 }}>
          <strong>Servidor indisponível.</strong> Verifique se o sistema está rodando
          (<code>start.command</code>) e recarregue a página.
        </div>
      )}
      <header className="app-header">
        <h1>Assistente Financeiro</h1>
        <div className="app-toolbar">
          <label htmlFor="year-select">Ano</label>
          <select id="year-select" value={anoSelecionado} onChange={e => setAnoSelecionado(Number(e.target.value))} style={styles.yearSelect}>
            {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
          <button
            className="toolbar-btn"
            onClick={() => setTema(t => (t === 'dark' ? 'light' : 'dark'))}
            title={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          >
            {tema === 'dark' ? '☀' : '☾'}
          </button>
          <button className="toolbar-btn" onClick={() => setPerfilAberto(true)}>Perfil</button>
          <button className="toolbar-btn" onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <nav className="app-tabs" role="tablist">
        {ABAS.map(aba => (
          <button
            key={aba.id}
            role="tab"
            className="app-tab"
            aria-selected={abaAtiva === aba.id}
            onClick={() => setAbaAtiva(aba.id)}
          >
            {aba.label}
          </button>
        ))}
      </nav>

      {(abaAtiva === 'visualizacao' || abaAtiva === 'uber') && (
        <div className="app-months" ref={mesesRef}>
          {nomesMeses.map((mesNome, idx) => (
            <button
              key={idx + 1}
              className="app-month"
              aria-pressed={mesSelecionado === idx + 1}
              onClick={() => setMesSelecionado(idx + 1)}
            >
              {mesNome}
            </button>
          ))}
        </div>
      )}

      <main>
        {abaAtiva === 'visualizacao' && (
          <div className="visualizacao-grid">
            <div className="visualizacao-main">
              <CardResumoMes ano={anoSelecionado} mes={mesSelecionado} />
              {alertas.length > 0 && (
                <div className="aviso aviso-alerta">
                  <h3>Alertas</h3>
                  <ul>
                    {alertas.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Dashboard gastosCategoria={gastosCategoria} evolucaoMensal={evolucaoMensal} resumoAnual={resumoAnual} ano={anoSelecionado} />
              <TransactionList refreshFlag={refresh} ano={anoSelecionado} mes={mesSelecionado} />
            </div>
            <aside className="visualizacao-sidebar">
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
  yearSelect: {
    fontSize: '0.95rem',
    padding: '5px 8px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
  },
};

export default App;
