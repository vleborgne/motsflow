import { t } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { useEffect, useState } from 'react';

function extractChapters(markdown: string): string[] {
  // Extract lines that start with '## ' (chapters)
  return markdown
    .split('\n')
    .filter(line => line.startsWith('## '))
    .map(line => line.replace(/^##\s*/, ''));
}

export default function Redaction({ locale = 'fr' }: { locale?: Locale }) {
  const [chapters, setChapters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/book-plan?format=md');
        if (!res.ok) throw new Error('fetch');
        const markdown = await res.text();
        setChapters(extractChapters(markdown));
      } catch (e) {
        setError('fetch');
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, []);

  const handleRedactChapter = async (chapterNumber: number, chapterTitle: string) => {
    try {
      const res = await fetch('/api/redact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterNumber, chapterTitle }),
      });
      const data = await res.json();
      console.log('Redact API response:', data);
    } catch (e) {
      console.error('Redact API error:', e);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-2">
        {t('redaction.title', locale)}
      </h3>
      {loading && (
        <p className="text-gray-500">{t('redaction.loading', locale)}</p>
      )}
      {error && (
        <p className="text-red-500">{t('redaction.error', locale)}</p>
      )}
      {!loading && !error && (
        <>
          <p className="text-gray-700 mb-2">{t('redaction.chaptersList', locale)}</p>
          <ul className="list-disc pl-6">
            {chapters.map((chapter, idx) => (
              <li key={idx} className="flex items-center gap-4 mb-2">
                <span>{chapter}</span>
                <button
                  className="ml-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  type="button"
                  onClick={() => handleRedactChapter(idx + 1, chapter)}
                >
                  {t('redaction.writeChapter', locale)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
} 