import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Categoria {
  id: number;
  nome: string;
  tipo: string;
}

interface Transacao {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  origem?: string | null;
  destino?: string | null;
  categoria_id?: number;
  categoria?: Categoria;
}

interface Props {
  onTransactionCreated?: () => void;
  modoEdicao?: boolean;
  transacao?: Transacao | null;
  onCancel?: () => void;
  onTransactionUpdated?: () => void;
}

const TransactionForm: React.FC<Props> = ({
  onTransactionCreated,
  modoEdicao = false,
  transacao = null,
  onCancel,
  onTransactionUpdated
}) => {
  const [tipo, setTipo] = useState<'despesa' | 'rendimento'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    if (modoEdicao && transacao) {
      const valorAbsoluto = transacao.valor ? Math.abs(transacao.valor).toString() : '';
      setDescricao(transacao.descricao || '');
      setValor(valorAbsoluto);
      setData(transacao.data ? transacao.data.slice(0, 10) : '');
      setOrigem(transacao.origem || '');
      setDestino(transacao.destino || '');
      setCategoriaId(transacao.categoria?.id || transacao.categoria_id || null);
      setTipo(transacao.valor < 0 ? 'despesa' : 'rendimento');
    } else {
      setDescricao('');
      setValor('');
      setData(new Date().toISOString().slice(0, 10)); // Padrão para data atual na criação
      setOrigem('');
      setDestino('');
      setTipo('despesa');
      setCategoriaId(null);
    }
  }, [modoEdicao, transacao]);

  useEffect(() => {
    apiFetch(`${API_BASE}/categorias`)
      .then(res => res.json())
      .then(data => setCategorias(data));
  }, []);

  const categoriasFiltradas = categorias.filter(c => c.tipo === tipo);

  useEffect(() => {
    if (!categoriaId && categoriasFiltradas.length > 0) {
      setCategoriaId(categoriasFiltradas[0].id);
    }
    if (categoriasFiltradas.every(c => c.id !== categoriaId)) {
        setCategoriaId(categoriasFiltradas.length > 0 ? categoriasFiltradas[0].id : null);
    }
  }, [tipo, categoriasFiltradas, categoriaId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let valorNumerico = parseFloat(valor.replace(',', '.'));
    if (isNaN(valorNumerico)) {
      alert("Digite um valor válido.");
      return;
    }
    if (tipo === 'despesa' && valorNumerico > 0) valorNumerico = -valorNumerico;
    if (tipo === 'rendimento' && valorNumerico < 0) valorNumerico = Math.abs(valorNumerico);

    const payload = {
      descricao,
      valor: valorNumerico,
      data: data || new Date().toISOString().slice(0, 10),
      categoria_id: categoriaId,
      origem: origem || null,
      destino: destino || null,
    };

    const url = modoEdicao && transacao
      ? `${API_BASE}/transacoes/${transacao.id}`
      : `${API_BASE}/transacoes`;
    const method = modoEdicao ? 'PUT' : 'POST';

    apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Erro ao salvar transação.');
        return res.json();
      })
      .then(() => {
        if (modoEdicao) {
          onTransactionUpdated && onTransactionUpdated();
        } else {
          setDescricao('');
          setValor('');
          onTransactionCreated && onTransactionCreated();
        }
      })
      .catch(err => alert(err.message));
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>{modoEdicao ? 'Editar Transação' : 'Adicionar Movimentação Manual'}</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="tipo">Tipo</label>
            <select id="tipo" value={tipo} onChange={e => setTipo(e.target.value as 'despesa' | 'rendimento')} style={styles.select}>
              <option value="despesa">Despesa</option>
              <option value="rendimento">Rendimento</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="categoria">Categoria</label>
            <select id="categoria" value={categoriaId ?? ''} onChange={e => setCategoriaId(Number(e.target.value))} style={styles.select} required>
              {categoriasFiltradas.length === 0 && <option value="">Nenhuma categoria</option>}
              {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="origem">Origem (opcional)</label>
            <input
              id="origem"
              value={origem}
              onChange={e => setOrigem(e.target.value)}
              style={styles.input}
              placeholder="Ex: Asa Norte"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="destino">Destino (opcional)</label>
            <input
              id="destino"
              value={destino}
              onChange={e => setDestino(e.target.value)}
              style={styles.input}
              placeholder="Ex: Aeroporto"
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="descricao">Descrição</label>
          <input id="descricao" required value={descricao} onChange={e => setDescricao(e.target.value)} style={styles.input} />
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="valor">Valor (R$)</label>
            <input id="valor" required type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} style={styles.input} placeholder="Ex: 50,00" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="data">Data</label>
            <input id="data" type="date" value={data} onChange={e => setData(e.target.value)} style={styles.input} />
          </div>
        </div>

        <div style={styles.buttonGroup}>
          {modoEdicao && onCancel && (
            <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
            {modoEdicao ? 'Salvar Alterações' : 'Adicionar Transação'}
          </button>
        </div>
      </form>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius)',
    padding: '24px',
    boxShadow: 'var(--box-shadow)',
  },
  title: {
    marginTop: 0,
    marginBottom: '24px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formRow: {
    display: 'flex',
    gap: '16px'
  },
  formGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    marginBottom: '8px',
    fontWeight: 500,
    fontSize: '0.9rem',
    color: 'var(--color-text-light)'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
    fontSize: '1rem',
    boxSizing: 'border-box'
  },
  select: {
     width: '100%',
     padding: '12px 16px',
     borderRadius: 'var(--border-radius)',
     border: '1px solid var(--color-border)',
     fontSize: '1rem',
     boxSizing: 'border-box',
     background: 'white'
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px'
  }
};

export default TransactionForm;
