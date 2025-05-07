import { t } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import ChatSidebar from './ChatSidebar';

// Extract parts: each part is a level 1 heading ("# ") and its summary (until next part or end)
type Part = { title: string; summary: string };
function extractParts(markdown: string): Part[] {
  const lines = markdown.split('\n');
  const parts: Part[] = [];
  let currentTitle = '';
  let currentSummary: string[] = [];
  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (currentTitle) {
        parts.push({ title: currentTitle, summary: currentSummary.join('\n').trim() });
      }
      currentTitle = line.replace(/^#\s*/, '');
      currentSummary = [];
    } else {
      if (currentTitle) currentSummary.push(line);
    }
  }
  if (currentTitle) {
    parts.push({ title: currentTitle, summary: currentSummary.join('\n').trim() });
  }
  return parts;
}

// Dynamically import SimpleMDEEditor to avoid SSR issues
const SimpleMDEEditor = dynamic(() => import('react-simplemde-editor'), { ssr: false });

function extractPartNumber(partTitle: string): string {
  // Extracts the Roman numeral or number before the first dot (e.g., 'I' from 'I. Setup')
  const match = partTitle.match(/^([IVXLCDM0-9]+)\s*\./i);
  return match ? match[1] : partTitle.replace(/\W+/g, '_');
}

// Helper to extract the first chapter number from part detail markdown
function extractFirstChapterNumber(partDetail: string): string | null {
  const lines = partDetail.split('\n');
  for (const line of lines) {
    const match = line.match(/^##\s+([IVXLCDM0-9]+\.[0-9]+)\s+/);
    if (match) return match[1];
  }
  return null;
}

export default function Redaction({ locale = 'fr' }: { locale?: Locale }) {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [partDetails, setPartDetails] = useState<Record<number, string>>({});
  const [partDetailsLoading, setPartDetailsLoading] = useState<Record<number, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [redacting, setRedacting] = useState(false);
  const [redactResult, setRedactResult] = useState<any>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/book-plan?format=md');
        if (!res.ok) throw new Error('fetch');
        const markdown = await res.text();
        setParts(extractParts(markdown));
      } catch (e) {
        setError('fetch');
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, []);

  // Fetch part detail file when switching tab (if not already loaded)
  useEffect(() => {
    if (!parts[activeTab]) return;
    if (partDetails[activeTab] !== undefined) return;
    const partNumber = extractPartNumber(parts[activeTab].title);
    setPartDetailsLoading(prev => ({ ...prev, [activeTab]: true }));
    fetch(`/api/book-plan/part-detail?partNumber=${partNumber}`)
      .then(async res => {
        if (!res.ok) return '';
        return await res.text();
      })
      .then(md => setPartDetails(prev => ({ ...prev, [activeTab]: md })))
      .finally(() => setPartDetailsLoading(prev => ({ ...prev, [activeTab]: false })));
  }, [activeTab, parts]);

  const handleGenerateDetail = async (idx: number) => {
    setGenerating(true);
    setError(null);
    try {
      const part = parts[idx];
      const res = await fetch('/api/book-plan/part-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partTitle: part.title,
          partSummary: part.summary,
        }),
      });
      if (!res.ok) throw new Error('generation');
      const data = await res.json();
      setPartDetails(prev => ({ ...prev, [idx]: data.detail }));
    } catch (e) {
      setError('generation');
    } finally {
      setGenerating(false);
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
      {!loading && !error && parts.length > 0 && (
        <>
          <div className="flex gap-2 mb-4 border-b">
            {parts.map((part, idx) => (
              <button
                key={idx}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === idx ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
                onClick={() => setActiveTab(idx)}
                type="button"
              >
                {part.title}
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-col md:flex-row bg-white rounded shadow overflow-auto">
            <div className="flex-1 p-4" style={{ minWidth: 0 }}>
              <h4 className="text-lg font-semibold mb-2">{parts[activeTab].title}</h4>
              <p className="whitespace-pre-line text-gray-700 mb-4">{parts[activeTab].summary}</p>
              <div className="flex flex-row gap-2 mb-4">
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                  type="button"
                  disabled={generating}
                  onClick={() => handleGenerateDetail(activeTab)}
                >
                  {generating && <span className="animate-spin mr-2">⏳</span>}
                  {t('redaction.generatePartDetail', locale)}
                </button>
                {partDetails[activeTab] && partDetails[activeTab].trim() && (
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                    type="button"
                    disabled={redacting}
                    onClick={async () => {
                      setRedacting(true);
                      setRedactResult(null);
                      try {
                        const partNumber = extractPartNumber(parts[activeTab].title);
                        const partDetail = partDetails[activeTab];
                        const chapterNumber = extractFirstChapterNumber(partDetail);
                        if (!chapterNumber) throw new Error('No chapter found in part detail');
                        const res = await fetch('/api/redact', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ partNumber, chapterNumberToRedact: chapterNumber }),
                        });
                        if (!res.ok) throw new Error('Redaction failed');
                        const data = await res.json();
                        setRedactResult(data);
                        console.log('Redaction result:', data);
                      } catch (e) {
                        setRedactResult({ error: e instanceof Error ? e.message : String(e) });
                      } finally {
                        setRedacting(false);
                      }
                    }}
                  >
                    {redacting ? <span className="animate-spin mr-2">⏳</span> : null}
                    {t('redaction.write', locale)}
                  </button>
                )}
              </div>
              <div className="mt-4">
                {partDetailsLoading[activeTab] ? (
                  <div className="text-gray-500">{t('redaction.loading', locale)}</div>
                ) : (
                  <SimpleMDEEditor
                    key={activeTab + (partDetails[activeTab] || '')}
                    value={partDetails[activeTab] || ''}
                    options={{
                      spellChecker: false,
                      placeholder: t('redaction.placeholder', locale),
                      status: false,
                      autofocus: false,
                      autosave: undefined,
                    }}
                    onChange={() => {}}
                  />
                )}
              </div>
            </div>
            <div className="border-l border-gray-200 p-4 bg-gray-50" style={{ width: 320, minHeight: 400 }}>
              <ChatSidebar locale={locale as 'en' | 'fr'} prompt={chatPrompt} setPrompt={setChatPrompt} />
            </div>
          </div>
        </>
      )}
      {!loading && !error && parts.length === 0 && (
        <p className="text-gray-500">{t('redaction.noParts', locale)}</p>
      )}
      {redactResult && (
        <div className="mt-6 p-4 bg-blue-50 border rounded text-sm">
          {redactResult.error ? (
            <span className="text-red-600">Erreur : {redactResult.error}</span>
          ) : (
            <>
              <div className="font-bold mb-2">Chapitre généré :</div>
              <pre className="whitespace-pre-wrap">{redactResult.text}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
} 