import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch, mensagemErro, ERRO_REDE } from '../api';

interface RespostaIA {
  resposta: string;
  destaques: string[];
  sugestoes: string[];
  perguntas_sugeridas: string[];
}

interface Troca {
  pergunta: string;
  resultado: RespostaIA;
}

interface Props {
  ano: number;
  /** null = ano inteiro */
  mes: number | null;
  /** null = todas as categorias */
  categoria: string | null;
  /** Nome do cartão: analisa só as compras dele (lista da fatura) */
  cartao?: string | null;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
// O backend aceita até 6 trocas anteriores como contexto
const MAX_HISTORICO = 6;

function perguntasIniciais(categoria: string | null, cartao: string | null): string[] {
  if (cartao && !categoria) {
    return [
      'O que mais pesou nesta fatura?',
      'Quais parcelas comprometem os próximos meses?',
      'Há assinaturas ou cobranças repetidas?',
      'Onde posso cortar nesta fatura?',
    ];
  }
  if (categoria) {
    return [
      `O que posso melhorar em ${categoria}?`,
      'Esse gasto está acima do normal?',
      'Quais lançamentos mais pesaram?',
      'Há gastos repetidos ou duplicados?',
    ];
  }
  return [
    'Onde posso economizar?',
    'Como está o uso dos meus cartões?',
    'Quanto gasto com Uber e 99, e como reduzir?',
    'Quais gastos são recorrentes ou assinaturas?',
    'Há gastos fora do padrão?',
  ];
}

const AnaliseIA: React.FC<Props> = ({ ano, mes, categoria, cartao = null }) => {
  const [conversa, setConversa] = useState<Troca[]>([]);
  const [pergunta, setPergunta] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  // Mudou o recorte: a conversa anterior falava de outros dados
  useEffect(() => {
    setConversa([]);
    setErro(null);
  }, [ano, mes, categoria, cartao]);

  useEffect(() => {
    if (conversa.length > 0) fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [conversa.length]);

  const recorte = `${categoria ?? 'Todas as categorias'} · ${mes ? `${MESES[mes - 1]}/${ano}` : `Ano de ${ano}`} · ${cartao ? `cartão ${cartao}` : 'conta + cartões'}`;

  const perguntar = async (texto: string) => {
    if (carregando) return;
    const q = texto.trim();
    setCarregando(true);
    setErro(null);
    try {
      const resp = await apiFetch(`${API_BASE}/ia/analisar-movimentacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ano,
          mes,
          categoria,
          cartao,
          pergunta: q || null,
          historico: conversa.slice(-MAX_HISTORICO).map(t => ({
            pergunta: t.pergunta,
            resposta: t.resultado.resposta.slice(0, 6000),
          })),
        }),
      });
      if (!resp.ok) {
        setErro(await mensagemErro(resp));
        return;
      }
      const resultado: RespostaIA = await resp.json();
      setConversa(c => [...c, { pergunta: q || 'Análise geral', resultado }]);
      setPergunta('');
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setCarregando(false);
    }
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (pergunta.trim()) perguntar(pergunta);
  };

  const ultima = conversa[conversa.length - 1];
  const sugestoes = ultima?.resultado.perguntas_sugeridas.length
    ? ultima.resultado.perguntas_sugeridas
    : perguntasIniciais(categoria, cartao);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.titulo}>Análise com IA</h3>
          <p style={styles.recorte}>{recorte}</p>
        </div>
        {conversa.length === 0 ? (
          <button type="button" style={styles.btnPrimario} onClick={() => perguntar('')} disabled={carregando}>
            {carregando ? 'Analisando...' : 'Analisar'}
          </button>
        ) : (
          <button type="button" style={styles.btnSecundario} onClick={() => setConversa([])} disabled={carregando}>
            Nova conversa
          </button>
        )}
      </div>

      {conversa.map((t, i) => (
        <div key={i} style={styles.troca}>
          <div style={styles.pergunta}>{t.pergunta}</div>
          {t.resultado.resposta && <p style={styles.resposta}>{t.resultado.resposta}</p>}
          {t.resultado.destaques.length > 0 && (
            <>
              <div style={styles.secaoTitulo}>Destaques</div>
              <ul style={styles.lista}>
                {t.resultado.destaques.map((d, j) => <li key={j}>{d}</li>)}
              </ul>
            </>
          )}
          {t.resultado.sugestoes.length > 0 && (
            <>
              <div style={styles.secaoTitulo}>O que melhorar</div>
              <ol style={styles.lista}>
                {t.resultado.sugestoes.map((s, j) => <li key={j}>{s}</li>)}
              </ol>
            </>
          )}
        </div>
      ))}
      <div ref={fimRef} />

      {erro && <div className="aviso aviso-erro" style={styles.erro}>{erro}</div>}

      <div style={styles.chips}>
        {sugestoes.map(s => (
          <button key={s} type="button" style={styles.chip} onClick={() => perguntar(s)} disabled={carregando}>
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} style={styles.form}>
        <textarea
          value={pergunta}
          onChange={e => setPergunta(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(e);
          }}
          placeholder="Pergunte o que quiser sobre esses gastos. Ex.: quanto gastei com delivery e como reduzir?"
          maxLength={1000}
          rows={2}
          style={styles.textarea}
          disabled={carregando}
        />
        <button type="submit" style={styles.btnPrimario} disabled={carregando || !pergunta.trim()}>
          {carregando ? 'Pensando...' : 'Perguntar'}
        </button>
      </form>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    background: 'var(--color-surface)',
    padding: 'clamp(16px, 3vw, 24px)',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--box-shadow)',
    marginTop: '24px',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
  },
  titulo: { margin: 0, border: 'none', padding: 0 },
  recorte: { margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--color-text-light)' },
  btnPrimario: {
    padding: '8px 18px',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-primary)',
    background: 'var(--color-primary)',
    color: 'var(--color-on-primary, #fff)',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  btnSecundario: {
    padding: '8px 16px',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-dark)',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  troca: {
    borderTop: '1px solid var(--color-border)',
    paddingTop: '14px',
    marginTop: '14px',
  },
  pergunta: {
    display: 'inline-block',
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    fontWeight: 600,
    fontSize: '0.9rem',
    padding: '6px 12px',
    borderRadius: '12px',
    marginBottom: '8px',
  },
  resposta: { margin: '4px 0 8px', lineHeight: 1.55, color: 'var(--color-text-dark)' },
  secaoTitulo: {
    fontWeight: 600,
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--color-text-light)',
    margin: '12px 0 4px',
  },
  lista: { margin: 0, paddingLeft: '20px', lineHeight: 1.55 },
  erro: { marginTop: '14px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '16px 0 10px' },
  chip: {
    padding: '6px 12px',
    borderRadius: '999px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-muted)',
    color: 'var(--color-text-dark)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textAlign: 'left',
  },
  form: { display: 'flex', gap: '8px', alignItems: 'stretch', flexWrap: 'wrap' },
  textarea: {
    flex: '1 1 240px',
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    background: 'var(--color-surface)',
    color: 'var(--color-text-dark)',
  },
};

export default AnaliseIA;
