import React, { useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Props {
  onUpload?: () => void;
}

const UploadNota: React.FC<Props> = ({ onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    setUploading(true);
    setStatus('Importando...');
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const resp = await apiFetch(`${API_BASE}/nota/upload`, {
        method: 'POST',
        body: formData
      });
      if (!resp.ok) throw new Error('Erro ao importar nota');
      
      setStatus('Importado com sucesso!');
      onUpload && onUpload();
      setTimeout(() => setStatus(''), 2000); // Limpa a mensagem após 2s
    } catch (err) {
      setStatus('Falha na importação.');
      setTimeout(() => setStatus(''), 2000);
    } finally {
      setUploading(false);
      e.target.value = ''; // Permite selecionar o mesmo arquivo novamente
    }
  };

  return (
    <label style={styles.buttonWrapper}>
      <div style={styles.icon}>🧾</div>
      <div style={styles.textContainer}>
        <span style={styles.title}>Importar Nota/Recibo</span>
        <span style={styles.subtitle}>Envie uma imagem ou PDF</span>
      </div>
      <input 
        type="file" 
        accept=".png,.jpg,.jpeg,.pdf" 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
        disabled={uploading} 
      />
      {status && <div style={styles.statusOverlay}>{uploading ? 'Processando...' : status}</div>}
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
    background: 'rgba(255, 255, 255, 0.9)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 600,
    color: 'var(--color-primary)'
  }
};

export default UploadNota;
