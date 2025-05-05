import React, { useState } from 'react';
import { t } from '@/lib/i18n';

interface ChatSidebarProps {
  locale: 'en' | 'fr';
  prompt: string;
  setPrompt: (v: string) => void;
}

export default function ChatSidebar({ locale, prompt, setPrompt }: ChatSidebarProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleModifyPlan = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/${locale}/api/book-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t('bookPlanDisplay.error', locale));
      }
      setSuccess(t('bookPlanDisplay.modifyingPlan', locale));
      setPrompt('');
    } catch (err: any) {
      setError(err.message || t('bookPlanDisplay.error', locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      <h2 style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '1rem' }}>Chat</h2>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder={t('bookPlanDisplay.modifyPlanPrompt', locale)}
        rows={3}
        style={{ width: '100%', marginBottom: 8, resize: 'vertical' }}
        disabled={loading}
      />
      <button
        onClick={handleModifyPlan}
        disabled={loading || !prompt.trim()}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: 6,
          background: loading || !prompt.trim() ? '#ccc' : '#2563eb',
          color: loading || !prompt.trim() ? '#888' : '#fff',
          fontWeight: 600,
          cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
          marginBottom: 8,
        }}
      >
        {loading ? t('bookPlanDisplay.modifyingPlan', locale) : t('bookPlanDisplay.modifyPlan', locale)}
      </button>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: 'green', marginBottom: 8 }}>{success}</div>}
    </div>
  );
} 