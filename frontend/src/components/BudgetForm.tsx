import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Categoria {
  id: number;
  nome: string;
  tipo: string; // Adicionado para filtrar apenas categorias de despesa
}

interface Props {
  ano: number;
  mes: number;
  onOrcamentoSalvo?: () => void;
}

const BudgetForm: React.FC<Props> = ({ ano, mes, onOrcamentoSalvo }) => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [valorLimite, setValorLimite] = useState('');

  useEffect(() => {
    apiFetch(`${API_BASE}/categorias`)
      .then(res => res.json())
      .then((data: Categoria[]) => {
        const apenasDespesas = data.filter(c => c.tipo === 'despesa');
        setCategorias(apenasDespesas);
        if (apenasDespesas.length > 0) {
          setCategoriaId(apenasDespesas[0].id);
        }
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoriaId) {
      alert("Selecione uma categoria.");
      return;
    }
    const payload = {
      categoria_id: categoriaId,
      ano: ano,
      mes: mes,
      valor_limite: parseFloat(valorLimite.replace(',', '.'))
    };
    apiFetch(`${API_BASE}/orcamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error("Erro ao salvar orçamento. Verifique se já não existe um para esta categoria no mês.");
        setValorLimite('');
        onOrcamentoSalvo && onOrcamentoSalvo();
      })
      .catch(err => alert(err.message));
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Criar Orçamento</h3>
      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label htmlFor="budget-cat" style={styles.label}>Categoria</label>
          <select
            id="budget-cat"
            value={categoriaId ?? ''}
            onChange={e => setCategoriaId(Number(e.target.value))}
            required
            style={styles.input}
          >
            {categorias.length === 0 && <option value="">Nenhuma categoria de despesa</option>}
            {categorias.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nome}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="budget-limit" style={styles.label}>Valor Limite (R$)</label>
          <input
            id="budget-limit"
            type="number"
            min={0}
            step="0.01"
            placeholder="Ex: 500,00"
            value={valorLimite}
            onChange={e => setValorLimite(e.target.value)}
            style={styles.input}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
          Salvar Orçamento
        </button>
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
    marginBottom: '16px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
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
    boxSizing: 'border-box',
    background: 'white'
  },
};

export default BudgetForm;
