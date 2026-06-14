import React, { useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Props {
  onUpload?: () => void;
}

const UploadExtrato: React.FC<Props> = ({ onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    setUploading(true);
    setStatus('Importando...');
    setIsError(false);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const resp = await apiFetch(`${API_BASE}/extrato/upload`, {
        method: 'POST',
        body: formData
      });

      let result: { message?: string; detail?: string | string[] };
      try {
        result = await resp.json();
      } catch {
        result = {};
      }

      if (!resp.ok) {
        const detail = result.detail;
        const msg = Array.isArray(detail)
          ? detail.join('. ')
          : typeof detail === 'string'
            ? detail
            : 'Erro ao processar o extrato.';
        throw new Error(msg);
      }

      setStatus(result.message || 'Importado com sucesso!');
      onUpload && onUpload();
      setTimeout(() => setStatus(''), 3000);
    } catch (err: any) {
      setIsError(true);
      const msg =
        err.message === 'Failed to fetch'
          ? 'Verifique sua conexão com o servidor.'
          : err.message || 'Falha na importação.';
      setStatus(msg);
      setTimeout(() => setStatus(''), 5000);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <label style={styles.buttonWrapper}>
      <div style={styles.icon}>📄</div>
      <div style={styles.textContainer}>
        <span style={styles.title}>Importar Extrato</span>
        <span style={styles.subtitle}>Envie um arquivo .CSV</span>
      </div>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
        disabled={uploading} 
      />
      {status && 
        <div style={{...styles.statusOverlay, color: isError ? 'var(--color-error)' : 'var(--color-primary)'}}>
            {status}
        </div>
      }
    </label>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  buttonWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    borderRadius: 'var(--border-radius)',
    background: '#f9fafb',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '250px',
    overflow: 'hidden'
  },
  icon: {
    fontSize: '2rem',
  },
  textContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  title: {
    fontWeight: 600,
    color: 'var(--color-text-dark)'
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--color-text-light)'
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(255, 255, 255, 0.95)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 600,
    padding: '0 10px',
    textAlign: 'center'
  }
};

export default UploadExtrato;
