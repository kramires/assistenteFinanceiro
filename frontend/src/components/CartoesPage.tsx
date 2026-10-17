import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch, mensagemErro, ERRO_REDE } from '../api';
import CartaoCard from './CartaoCard';
import LancamentosFatura from './LancamentosFatura';
import ParcelasFuturas from './ParcelasFuturas';
import CartoesDashboard from './CartoesDashboard';

type Aba = 'faturas' | 'parcelas' | 'dashboard';

interface Cartao {
  id: number;
  nome: string;
  bandeira: string | null;
  final_numero: string | null;
  limite: number | null;
  cor: string;
}

interface FaturaResumo {
  id: number;
  cartao_id: number;
  cartao_nome: string;
  mes_referencia: string;
  data_vencimento: string | null;
  valor_total: number;
  status: string;
  total_lancamentos: number;
}

interface Categoria {
  id: number;
  nome: string;
}

const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CartoesPage() {
  const [aba, setAba] = useState<Aba>('faturas');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [faturas, setFaturas] = useState<FaturaResumo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedCartaoId, setSelectedCartaoId] = useState<number | null>(null);
  const [selectedFaturaId, setSelectedFaturaId] = useState<number | null>(null);
  const [mes, setMes] = useState(mesAtual());
  const [showImport, setShowImport] = useState(false);
  const [showNewCard, setShowNewCard] = useState(false);
  const [msg, setMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [showPagar, setShowPagar] = useState<{ id: number; valor: number } | null>(null);
  const [pagarData, setPagarData] = useState('');
  const [pagando, setPagando] = useState(false);
  const [pagarErro, setPagarErro] = useState('');

  // Import form state
  const [impCartaoId, setImpCartaoId] = useState('');
  const [impMes, setImpMes] = useState(mesAtual());
  const [impVenc, setImpVenc] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // New card form
  const [newNome, setNewNome] = useState('');
  const [newBandeira, setNewBandeira] = useState('');
  const [newFinal, setNewFinal] = useState('');
  const [newLimite, setNewLimite] = useState('');
  const [newCor, setNewCor] = useState('#6C63FF');

  const loadAll = useCallback(async () => {
    const [resC, resF, resCat] = await Promise.all([
      apiFetch(`${API_BASE}/cartoes`).then(r => r.json()),
      apiFetch(`${API_BASE}/faturas`).then(r => r.json()),
      apiFetch(`${API_BASE}/categorias`).then(r => r.json()),
    ]);
    setCartoes(resC);
    setFaturas(resF);
    setCategorias(resCat);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const faturasVisiveis = faturas.filter(f =>
    (selectedCartaoId ? f.cartao_id === selectedCartaoId : true)
  );

  const faturasDoMes = faturasVisiveis.filter(f => f.mes_referencia === mes);

  const handleSelectCartao = (id: number) => {
    setSelectedCartaoId(prev => prev === id ? null : id);
    setSelectedFaturaId(null);
  };

  const handleSelectFatura = (id: number) => {
    setSelectedFaturaId(prev => prev === id ? null : id);
  };

  // Convenção do sistema: mês de referência = mês anterior ao vencimento
  // (fatura que vence em 05/10 traz as compras de setembro).
  const alterarVencimento = (venc: string) => {
    setImpVenc(venc);
    if (!venc) return;
    const [ano, mesVenc] = venc.split('-').map(Number);
    const anterior = new Date(ano, mesVenc - 2, 1);
    setImpMes(`${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !impCartaoId) { setMsg('Selecione um cartão e um arquivo.'); return; }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('cartao_id', impCartaoId);
    formData.append('mes_referencia', impMes);
    if (impVenc) formData.append('data_vencimento', impVenc);

    setImporting(true);
    setMsg(file.name.toLowerCase().endsWith('.pdf')
      ? 'Lendo a fatura com IA e categorizando... pode levar 1–2 minutos.'
      : 'Importando e categorizando...');
    try {
      const res = await apiFetch(`${API_BASE}/faturas/importar`, { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setMsg(`✓ Importado: ${data.total_lancamentos} lançamentos — R$ ${data.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        setShowImport(false);
        await loadAll();
        setSelectedFaturaId(data.fatura_id);
      } else {
        setMsg(`Erro: ${await mensagemErro(res)}`);
      }
    } catch {
      setMsg(`Erro: ${ERRO_REDE}`);
    } finally {
      setImporting(false);
    }
  };

  const handleCriarCartao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome) return;
    const res = await apiFetch(`${API_BASE}/cartoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: newNome, bandeira: newBandeira || null, final_numero: newFinal || null, limite: newLimite ? parseFloat(newLimite) : null, cor: newCor }),
    });
    if (res.ok) {
      setShowNewCard(false);
      setNewNome(''); setNewBandeira(''); setNewFinal(''); setNewLimite('');
      await loadAll();
    }
  };

  const handleExcluirCartao = async (id: number) => {
    if (!window.confirm('Excluir cartão e todas as faturas?')) return;
    await apiFetch(`${API_BASE}/cartoes/${id}`, { method: 'DELETE' });
    setSelectedCartaoId(null);
    await loadAll();
  };

  const abrirPagar = (id: number, valor: number) => {
    // Data padrão = vencimento: o pagamento cai no mês certo do dashboard
    const venc = faturas.find(f => f.id === id)?.data_vencimento;
    setPagarData(venc || new Date().toISOString().slice(0, 10));
    setPagarErro('');
    setShowPagar({ id, valor });
  };

  const handlePagar = async () => {
    if (!showPagar || pagando) return;
    setPagando(true);
    setPagarErro('');
    try {
      const res = await apiFetch(`${API_BASE}/faturas/${showPagar.id}/pagar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pagarData ? { data_pagamento: pagarData } : {}),
      });
      if (res.ok) {
        setMsg('Fatura marcada como paga e lançada no financeiro.');
        setShowPagar(null);
        await loadAll();
      } else {
        setPagarErro(await mensagemErro(res));
      }
    } catch {
      setPagarErro(ERRO_REDE);
    } finally {
      setPagando(false);
    }
  };

  const mesLabel = (m: string) => {
    const [ano, mo] = m.split('-');
    return `${nomesMeses[parseInt(mo) - 1]}/${ano.slice(2)}`;
  };

  const mesesDisponiveis = Array.from(new Set(faturas.map(f => f.mes_referencia))).sort().reverse();
  if (!mesesDisponiveis.includes(mes)) { /* keep current */ }

  return (
    <div style={styles.page}>
      {/* Abas */}
      <div style={styles.tabsRow}>
        {(['faturas', 'parcelas', 'dashboard'] as Aba[]).map(a => (
          <button
            key={a}
            style={aba === a ? styles.tabActive : styles.tab}
            onClick={() => setAba(a)}
          >
            {a === 'faturas' ? 'Faturas' : a === 'parcelas' ? 'Parcelas Futuras' : 'Dashboard'}
          </button>
        ))}
      </div>

      {msg && (
        <div
          style={msg.startsWith('Erro') ? { ...styles.msgBanner, ...styles.msgBannerErro } : styles.msgBanner}
          onClick={() => setMsg('')}
          title="Clique para fechar"
        >
          {msg}
        </div>
      )}

      {/* ── ABA FATURAS ── */}
      {aba === 'faturas' && (
        <div>
          {/* Cartões */}
          <div style={styles.cartoesRow}>
            {cartoes.map(c => {
              const faturaDoMes = faturas.find(f => f.cartao_id === c.id && f.mes_referencia === mes);
              return (
                <div key={c.id} style={{ position: 'relative' }}>
                  <CartaoCard
                    {...c}
                    isSelected={selectedCartaoId === c.id}
                    onClick={() => handleSelectCartao(c.id)}
                    valorFatura={faturaDoMes?.valor_total}
                    dataVencimento={faturaDoMes?.data_vencimento}
                    status={faturaDoMes?.status}
                  />
                  <button
                    style={styles.btnExcluirCartao}
                    onClick={(e) => { e.stopPropagation(); handleExcluirCartao(c.id); }}
                    title="Excluir cartão"
                  >×</button>
                </div>
              );
            })}

            <button style={styles.addCardBtn} onClick={() => setShowNewCard(v => !v)}>
              {showNewCard ? '✕' : '+ Cartão'}
            </button>
          </div>

          {/* Formulário novo cartão */}
          {showNewCard && (
            <form onSubmit={handleCriarCartao} style={styles.formCard}>
              <input placeholder="Nome do cartão *" value={newNome} onChange={e => setNewNome(e.target.value)} style={styles.input} required />
              <input placeholder="Bandeira (Visa, Master...)" value={newBandeira} onChange={e => setNewBandeira(e.target.value)} style={styles.input} />
              <input placeholder="4 últimos dígitos" value={newFinal} onChange={e => setNewFinal(e.target.value)} maxLength={4} style={{ ...styles.input, width: 120 }} />
              <input placeholder="Limite (R$)" value={newLimite} onChange={e => setNewLimite(e.target.value)} type="number" style={{ ...styles.input, width: 140 }} />
              <input type="color" value={newCor} onChange={e => setNewCor(e.target.value)} style={styles.colorPicker} />
              <button type="submit" style={styles.btnPrimary}>Salvar</button>
            </form>
          )}

          {/* Seletor de mês */}
          <div style={styles.mesRow}>
            <span style={styles.mesLabel}>Mês:</span>
            <div style={styles.mesesBtns}>
              {(mesesDisponiveis.length > 0 ? mesesDisponiveis : [mesAtual()]).map(m => (
                <button
                  key={m}
                  style={mes === m ? styles.mesBtnActive : styles.mesBtn}
                  onClick={() => { setMes(m); setSelectedFaturaId(null); }}
                >
                  {mesLabel(m)}
                </button>
              ))}
            </div>
            <button style={styles.btnImport} onClick={() => setShowImport(v => !v)}>
              {showImport ? '✕ Fechar' : '↑ Importar Fatura'}
            </button>
          </div>

          {/* Formulário importação */}
          {showImport && (
            <form onSubmit={handleImport} style={styles.importForm}>
              <h4 style={styles.importTitle}>Importar Fatura (Nubank CSV ou BB PDF)</h4>
              <div style={styles.importFields}>
                <div>
                  <label style={styles.label}>Cartão *</label>
                  <select value={impCartaoId} onChange={e => setImpCartaoId(e.target.value)} style={styles.select} required>
                    <option value="">Selecione</option>
                    {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Vencimento</label>
                  <input type="date" value={impVenc} onChange={e => alterarVencimento(e.target.value)} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label} title="Mês em que as compras foram feitas (o anterior ao vencimento)">
                    Mês das compras *
                  </label>
                  <input type="month" value={impMes} onChange={e => setImpMes(e.target.value)} style={styles.input} required />
                </div>
                <div>
                  <label style={styles.label}>Arquivo (.csv ou .pdf) *</label>
                  <input type="file" accept=".csv,.pdf" ref={fileRef} style={{ fontSize: '0.85rem' }} required />
                </div>
              </div>
              <button type="submit" style={styles.btnPrimary} disabled={importing}>
                {importing ? 'Importando...' : 'Importar'}
              </button>
            </form>
          )}

          {/* Lista de faturas do mês */}
          {faturasDoMes.length === 0 && !showImport && (
            <div style={styles.empty}>
              Nenhuma fatura em {mesLabel(mes)}.{' '}
              <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }} onClick={() => setShowImport(true)}>
                Importar fatura
              </span>
            </div>
          )}

          {faturasDoMes.length > 0 && (
            <div style={styles.faturasList}>
              {faturasDoMes.map(f => (
                <div
                  key={f.id}
                  style={{
                    ...styles.faturaRow,
                    background: selectedFaturaId === f.id ? 'var(--color-primary-light)' : 'var(--color-surface)',
                    border: selectedFaturaId === f.id ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  }}
                  onClick={() => handleSelectFatura(f.id)}
                >
                  <div>
                    <div style={styles.faturaCartao}>{f.cartao_nome}</div>
                    <div style={styles.faturaMeta}>
                      {f.total_lancamentos} lançamentos
                      {f.data_vencimento && ` • Vence ${new Date(f.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={styles.faturaValor}>
                      R$ {f.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <span style={f.status === 'paga' ? styles.badgePaga : styles.badgeAberta}>
                      {f.status === 'paga' ? 'PAGA' : 'ABERTA'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detalhe da fatura selecionada */}
          {selectedFaturaId && (
            <div style={{ marginTop: 20 }}>
              <LancamentosFatura
                faturaId={selectedFaturaId}
                categorias={categorias}
                onPagar={abrirPagar}
              />
            </div>
          )}

          {/* Modal pagar */}
          {showPagar && (
            <div style={styles.modalOverlay} onClick={() => setShowPagar(null)}>
              <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 12px' }}>Confirmar Pagamento</h3>
                <p style={{ color: 'var(--color-text-light)' }}>
                  Isso criará uma transação de{' '}
                  <strong>R$ {showPagar.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>{' '}
                  no seu registro financeiro e marcará a fatura como paga.
                </p>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-light)', marginTop: 12 }}>
                  Data do pagamento
                  <input
                    type="date"
                    value={pagarData}
                    onChange={e => setPagarData(e.target.value)}
                    style={{ ...styles.input, display: 'block', marginTop: 4 }}
                  />
                </label>
                {pagarErro && (
                  <p style={{ color: 'var(--color-error)', fontSize: '0.9rem', margin: '12px 0 0' }}>{pagarErro}</p>
                )}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button style={styles.btnCancel} onClick={() => setShowPagar(null)} disabled={pagando}>Cancelar</button>
                  <button style={{ ...styles.btnPrimary, opacity: pagando ? 0.6 : 1 }} onClick={handlePagar} disabled={pagando}>
                    {pagando ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA PARCELAS ── */}
      {aba === 'parcelas' && <ParcelasFuturas />}

      {/* ── ABA DASHBOARD ── */}
      {aba === 'dashboard' && (
        <div>
          <div style={styles.mesRow}>
            <span style={styles.mesLabel}>Mês:</span>
            <div style={styles.mesesBtns}>
              {(mesesDisponiveis.length > 0 ? mesesDisponiveis : [mesAtual()]).map(m => (
                <button
                  key={m}
                  style={mes === m ? styles.mesBtnActive : styles.mesBtn}
                  onClick={() => setMes(m)}
                >
                  {mesLabel(m)}
                </button>
              ))}
            </div>
          </div>
          <CartoesDashboard mes={mes} />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  tabsRow: { display: 'flex', gap: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 },
  tab: {
    padding: '8px 20px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.95rem',
    color: 'var(--color-text-light)',
    borderRadius: 'var(--border-radius)',
    fontWeight: 500,
  },
  tabActive: {
    padding: '8px 20px',
    border: 'none',
    background: 'var(--color-primary-light)',
    cursor: 'pointer',
    fontSize: '0.95rem',
    color: 'var(--color-primary)',
    borderRadius: 'var(--border-radius)',
    fontWeight: 700,
  },
  msgBanner: {
    padding: '10px 16px',
    background: 'var(--color-success-light)',
    border: '1px solid var(--color-success)',
    borderRadius: 8,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  msgBannerErro: {
    background: 'var(--color-error-light)',
    border: '1px solid var(--color-error)',
  },
  cartoesRow: { display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, alignItems: 'center' },
  addCardBtn: {
    minWidth: 100,
    height: 150,
    border: '2px dashed var(--color-border)',
    borderRadius: 16,
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--color-primary)',
    fontWeight: 600,
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  btnExcluirCartao: {
    position: 'absolute',
    top: 6,
    right: 6,
    background: 'rgba(0,0,0,0.25)',
    border: 'none',
    color: '#fff',
    borderRadius: '50%',
    width: 20,
    height: 20,
    cursor: 'pointer',
    fontSize: '0.9rem',
    lineHeight: '20px',
    textAlign: 'center',
    padding: 0,
  },
  formCard: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: '16px 0',
    borderBottom: '1px solid var(--color-border)',
  },
  input: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    fontSize: '0.9rem',
  },
  colorPicker: { width: 40, height: 36, padding: 2, borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'pointer' },
  btnPrimary: {
    padding: '8px 20px',
    background: 'var(--color-primary)',
    color: 'var(--color-on-primary)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  btnCancel: {
    padding: '8px 16px',
    background: 'transparent',
    color: 'var(--color-text-light)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  mesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    margin: '4px 0',
  },
  mesLabel: { fontSize: '0.85rem', color: 'var(--color-text-light)', fontWeight: 600 },
  mesesBtns: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  mesBtn: {
    padding: '5px 12px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  mesBtnActive: {
    padding: '5px 12px',
    borderRadius: 6,
    border: '2px solid var(--color-primary)',
    background: 'var(--color-primary-light)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--color-primary)',
  },
  btnImport: {
    padding: '6px 16px',
    border: '1px solid var(--color-primary)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--color-primary)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
    marginLeft: 'auto',
  },
  importForm: {
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    padding: '16px 20px',
  },
  importTitle: { margin: '0 0 12px', fontSize: '0.95rem', color: 'var(--color-text-dark)' },
  importFields: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 },
  label: { display: 'block', fontSize: '0.75rem', color: 'var(--color-text-light)', marginBottom: 4 },
  select: { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.9rem' },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--color-text-light)',
    background: 'var(--color-primary-light)',
    borderRadius: 'var(--border-radius)',
  },
  faturasList: { display: 'flex', flexDirection: 'column', gap: 8 },
  faturaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius)',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  faturaCartao: { fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-dark)' },
  faturaMeta: { fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: 2 },
  faturaValor: { fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-primary)', marginBottom: 4 },
  badgePaga: {
    padding: '2px 8px',
    background: '#4CAF50',
    color: '#fff',
    borderRadius: 4,
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  badgeAberta: {
    padding: '2px 8px',
    background: '#FF9800',
    color: '#fff',
    borderRadius: 4,
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--color-surface)',
    borderRadius: 16,
    padding: '24px 28px',
    minWidth: 340,
    maxWidth: 480,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
};
