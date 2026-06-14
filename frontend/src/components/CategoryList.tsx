import React, { useEffect, useState } from 'react';
import CategoryForm from './CategoryForm';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Categoria {
  id: number;
  nome: string;
  tipo: string;
}

const CategoryList: React.FC = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaEmEdicao, setCategoriaEmEdicao] = useState<Categoria | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(false);

  useEffect(() => {
    apiFetch(`${API_BASE}/categorias`)
      .then(res => res.json())
      .then(data => setCategorias(data));
  }, [refreshFlag]);

  const handleSuccess = () => {
    setCategoriaEmEdicao(null);
    setIsFormVisible(false);
    setRefreshFlag(flag => !flag);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Deseja realmente excluir esta categoria? As transações associadas não serão excluídas.')) {
      apiFetch(`${API_BASE}/categorias/${id}`, { method: 'DELETE' })
        .then(res => {
          if (!res.ok) throw new Error('Erro ao excluir categoria.');
          handleSuccess();
        })
        .catch(err => alert(err.message));
    }
  };

  const handleEdit = (cat: Categoria) => {
    setCategoriaEmEdicao(cat);
    setIsFormVisible(true);
  };
  
  const handleAddNew = () => {
    setCategoriaEmEdicao(null);
    setIsFormVisible(true);
  }

  const handleCancel = () => {
    setCategoriaEmEdicao(null);
    setIsFormVisible(false);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Gerenciar Categorias</h2>
        {!isFormVisible && (
          <button className="btn btn-primary" onClick={handleAddNew}>
            + Adicionar Categoria
          </button>
        )}
      </div>

      {/* Formulário só aparece se isFormVisible for true */}
      {isFormVisible && (
        <CategoryForm
          onCategoryCreated={handleSuccess}
          editando={!!categoriaEmEdicao}
          categoriaInicial={categoriaEmEdicao}
          onCancel={handleCancel}
        />
      )}

      {/* Tabela SEMPRE aparece, mesmo se vazia */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th style={{ textAlign: 'right' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {categorias.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', color: '#888', padding: 24 }}>
                Nenhuma categoria cadastrada.
              </td>
            </tr>
          ) : (
            categorias.map(cat => (
              <tr key={cat.id}>
                <td>{cat.nome}</td>
                <td>
                  <span style={{
                      ...styles.tipoBadge,
                      background: cat.tipo === 'despesa' ? 'var(--color-error)' : 'var(--color-success)'
                  }}>
                      {cat.tipo === 'despesa' ? 'Despesa' : 'Rendimento'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button style={styles.actionButton} onClick={() => handleEdit(cat)}>✏️ Editar</button>
                  <button style={{...styles.actionButton, color: 'var(--color-error)'}} onClick={() => handleDelete(cat.id)}>🗑️ Excluir</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius)',
    padding: 24,
    boxShadow: 'var(--box-shadow)',
    marginTop: 32,
    maxWidth: 700,
    marginLeft: 'auto',
    marginRight: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  title: {
    margin: 0
  },
  tipoBadge: {
    color: 'white',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  actionButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    padding: '8px',
    borderRadius: '6px',
    margin: '0 4px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 12,
  }
};

export default CategoryList;
