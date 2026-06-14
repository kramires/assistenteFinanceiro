import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Props {
  onCategoryCreated: () => void;
  editando?: boolean;
  categoriaInicial?: { id: number; nome: string; tipo: string } | null;
  onCancel?: () => void;
}

const CategoryForm: React.FC<Props> = ({ 
  onCategoryCreated, 
  editando = false, 
  categoriaInicial, 
  onCancel 
}) => {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'despesa' | 'rendimento'>('despesa');

  useEffect(() => {
    if (editando && categoriaInicial) {
      setNome(categoriaInicial.nome);
      setTipo(categoriaInicial.tipo as 'despesa' | 'rendimento');
    } else {
      setNome('');
      setTipo('despesa');
    }
  }, [editando, categoriaInicial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = editando && categoriaInicial
      ? `${API_BASE}/categorias/${categoriaInicial.id}`
      : `${API_BASE}/categorias`;
    
    const method = editando ? 'PUT' : 'POST';

    apiFetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, tipo })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Erro ao ${editando ? 'atualizar' : 'criar'} categoria.`);
        return res.json();
      })
      .then(() => {
        onCategoryCreated(); // Chama a função para refrescar a lista e fechar o form
      })
      .catch(err => alert(err.message));
  };

  return (
    <div style={styles.formContainer}>
      <h3 style={styles.title}>{editando ? 'Editar Categoria' : 'Adicionar Nova Categoria'}</h3>
      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label htmlFor="nome-categoria" style={styles.label}>Nome</label>
          <input
            id="nome-categoria"
            style={styles.input}
            required
            value={nome}
            onChange={e => setNome(e.target.value)}
          />
        </div>
        <div style={styles.formGroup}>
          <label htmlFor="tipo-categoria" style={styles.label}>Tipo</label>
          <select id="tipo-categoria" style={styles.input} value={tipo} onChange={e => setTipo(e.target.value as 'despesa' | 'rendimento')}>
            <option value="despesa">Despesa</option>
            <option value="rendimento">Rendimento</option>
          </select>
        </div>
        <div style={styles.buttonGroup}>
          <button type="button" className="btn" onClick={onCancel} style={{ background: '#eee' }}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            {editando ? 'Salvar Alterações' : 'Criar Categoria'}
          </button>
        </div>
      </form>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  formContainer: {
    padding: '24px',
    background: '#f9fafb',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    marginBottom: '24px'
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
  buttonGroup: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px'
  }
};

export default CategoryForm;