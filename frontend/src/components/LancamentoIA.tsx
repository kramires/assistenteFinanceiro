import React, { useRef, useState } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../api';

interface Props {
  onLancamentoFeito: () => void;
}

type Mode = 'idle' | 'recording' | 'processing';

const LancamentoIA: React.FC<Props> = ({ onLancamentoFeito }) => {
  const [texto, setTexto] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('idle');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const hasMic = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const isError = (msg: string | null) => msg?.startsWith('Erro');

  // ── Envio por texto ────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('Processando...');
    setMode('processing');
    apiFetch(`${API_BASE}/ia/lancar-texto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    })
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const d = body.detail;
          throw new Error(Array.isArray(d) ? d.join('. ') : d || 'Erro ao processar.');
        }
        return body;
      })
      .then(() => {
        setStatusMsg('Lançamento realizado!');
        setTexto('');
        onLancamentoFeito();
      })
      .catch(err => {
        const raw = err.message || 'Erro desconhecido';
        setStatusMsg('Erro: ' + (raw === 'Failed to fetch' ? 'Verifique sua conexão ou a chave da OpenAI.' : raw));
      })
      .finally(() => setMode('idle'));
  };

  // ── Gravação de áudio ──────────────────────────────────────────────────────
  const startRecording = async () => {
    setStatusMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => sendAudio(mimeType);
      recorder.start(200);
      setMode('recording');
    } catch {
      setStatusMsg('Erro: Permissão de microfone negada ou não disponível.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setMode('processing');
    setStatusMsg('Transcrevendo áudio...');
  };

  const sendAudio = (mimeType: string) => {
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, `audio.${ext}`);

    apiFetch(`${API_BASE}/ia/lancar-audio`, { method: 'POST', body: formData })
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const d = body.detail;
          throw new Error(Array.isArray(d) ? d.join('. ') : d || 'Erro ao processar áudio.');
        }
        return body;
      })
      .then((tx: { descricao: string; valor: number }) => {
        const sinal = tx.valor > 0 ? '+' : '';
        setStatusMsg(`Lançamento realizado: ${tx.descricao} (${sinal}R$ ${Math.abs(tx.valor).toFixed(2)})`);
        onLancamentoFeito();
      })
      .catch(err => {
        setStatusMsg('Erro: ' + (err.message || 'Erro desconhecido'));
      })
      .finally(() => setMode('idle'));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Lançamento Inteligente (IA)</h2>
      <p style={styles.subtitle}>Descreva sua transação ou use o microfone para falar.</p>

      <form onSubmit={handleSubmit}>
        <div style={styles.inputRow}>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Ex: almoço com cliente R$ 85,50 hoje"
            style={styles.input}
            disabled={mode !== 'idle'}
            required
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
            disabled={mode !== 'idle'}
          >
            Lançar
          </button>
        </div>
      </form>

      {hasMic && (
        <div style={styles.micSection}>
          <div style={styles.divider}>
            <span style={styles.dividerText}>ou</span>
          </div>

          {mode === 'idle' && (
            <button onClick={startRecording} style={styles.micBtn} title="Gravar por voz">
              <span style={styles.micIcon}>🎤</span>
              <span>Falar transação</span>
            </button>
          )}

          {mode === 'recording' && (
            <div style={styles.recordingRow}>
              <span style={styles.dot} />
              <span style={styles.recordingLabel}>Gravando...</span>
              <button onClick={stopRecording} style={styles.stopBtn}>
                Parar
              </button>
            </div>
          )}

          {mode === 'processing' && (
            <div style={styles.processingRow}>
              <span style={styles.processingLabel}>⏳ {statusMsg || 'Processando...'}</span>
            </div>
          )}
        </div>
      )}

      {statusMsg && mode === 'idle' && (
        <div style={{ ...styles.statusMessage, color: isError(statusMsg) ? 'var(--color-error)' : 'var(--color-success)' }}>
          {statusMsg}
        </div>
      )}
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
  title: { marginTop: 0, marginBottom: '8px' },
  subtitle: { marginTop: 0, marginBottom: '24px', color: 'var(--color-text-light)' },
  inputRow: { display: 'flex', gap: '12px', alignItems: 'center' },
  input: {
    width: '100%',
    fontSize: '1rem',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--color-border)',
  },
  micSection: { marginTop: '20px' },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    color: 'var(--color-text-light)',
    fontSize: '0.85rem',
  },
  dividerText: {
    background: 'var(--color-surface)',
    padding: '0 8px',
    position: 'relative',
  },
  micBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '14px 20px',
    border: '2px dashed var(--color-border)',
    borderRadius: 'var(--border-radius)',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '1rem',
    color: 'var(--color-text)',
    transition: 'border-color 0.2s, background 0.2s',
  },
  micIcon: { fontSize: '1.4rem' },
  recordingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
    border: '2px solid #e53935',
    borderRadius: 'var(--border-radius)',
    background: '#fff5f5',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#e53935',
    animation: 'pulse 1s infinite',
    flexShrink: 0,
  },
  recordingLabel: { flex: 1, color: '#e53935', fontWeight: 600 },
  stopBtn: {
    padding: '6px 18px',
    background: '#e53935',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--border-radius)',
    cursor: 'pointer',
    fontWeight: 600,
  },
  processingRow: {
    padding: '14px 20px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius)',
    background: 'var(--color-background)',
  },
  processingLabel: { color: 'var(--color-text-light)' },
  statusMessage: { marginTop: '16px', fontWeight: 500 },
};

export default LancamentoIA;
