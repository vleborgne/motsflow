import { t } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { useEffect, useState, useRef } from 'react';
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

// Helper to extract chapters from a part summary
function extractChaptersFromSummary(summary: string) {
  // Matches lines like: - **I.1 : La routine de Laila**  
  const chapterRegex = /^- \*\*([IVXLCDM0-9]+\.[0-9]+) : ([^*]+)\*\*/gm;
  const chapters: { number: string; title: string }[] = [];
  let match;
  while ((match = chapterRegex.exec(summary)) !== null) {
    chapters.push({ number: match[1], title: match[2].trim() });
  }
  return chapters;
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
  const [chapters, setChapters] = useState<Record<string, { number: string, title: string, content: string }[]>>({});
  const [activeChapterTab, setActiveChapterTab] = useState<Record<number, number>>({});
  const [chapterLoading, setChapterLoading] = useState<Record<string, boolean>>({});
  const [chapterMeta, setChapterMeta] = useState<Record<string, { title: string; description: string; scenesFile: string }[]>>({});
  const [activeChapterIdx, setActiveChapterIdx] = useState<Record<number, number>>({});
  const [activeSummaryChapterTab, setActiveSummaryChapterTab] = useState<Record<number, number>>({});
  const [editorContent, setEditorContent] = useState<Record<string, string>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const editorInstanceRef = useRef<any>(null); // Holds the SimpleMDE instance

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
          partNumber: extractPartNumber(part.title),
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

  // Utility to get chapter files for a part using the new API
  async function fetchChaptersForPart(partNumber: string) {
    const chapterList = [];
    for (let i = 1; i <= 20; i++) {
      try {
        const res = await fetch(`/api/scenes?partNumber=${partNumber}&chapterNumber=${i}`);
        if (!res.ok) break;
        const text = await res.text();
        // Extract chapter headings (### ...)
        const matches = [...text.matchAll(/^###\s+([IVXLCDM0-9\.]+)\s*:\s*(.+)$/gm)];
        for (const match of matches) {
          chapterList.push({ number: match[1], title: match[2], content: text });
        }
      } catch {
        break;
      }
    }
    return chapterList;
  }

  // Fetch chapters when part changes
  useEffect(() => {
    if (!parts[activeTab]) return;
    const partNumber = extractPartNumber(parts[activeTab].title);
    if (chapters[partNumber]) return;
    setChapterLoading(prev => ({ ...prev, [partNumber]: true }));
    fetchChaptersForPart(partNumber).then(list => {
      setChapters(prev => ({ ...prev, [partNumber]: list }));
      setActiveChapterTab(prev => ({ ...prev, [activeTab]: 0 }));
    }).finally(() => setChapterLoading(prev => ({ ...prev, [partNumber]: false })));
  }, [activeTab, parts]);

  // Reset active chapter tab to 0 when changing part
  useEffect(() => {
    setActiveChapterTab(prev => ({ ...prev, [activeTab]: 0 }));
  }, [activeTab]);

  // Fetch chapter content when chapter changes
  useEffect(() => {
    if (!parts[activeTab]) return;
    const partNumber = extractPartNumber(parts[activeTab].title);
    const idx = activeChapterIdx[activeTab] || 0;
    const meta = chapterMeta[partNumber];
    if (!meta || !meta[idx]) return;
    const scenesFile = meta[idx].scenesFile;
    if (chapters[partNumber] && chapters[partNumber][idx] && chapters[partNumber][idx].content) return;
    setChapterLoading(prev => ({ ...prev, [partNumber]: true }));
    fetch(`/data/parts/${scenesFile}`)
      .then(async res => {
        if (!res.ok) return '';
        return await res.text();
      })
      .then(text => {
        setChapters(prev => {
          const arr = prev[partNumber] ? [...prev[partNumber]] : [];
          arr[idx] = { ...(arr[idx] || {}), content: text };
          return { ...prev, [partNumber]: arr };
        });
      })
      .finally(() => setChapterLoading(prev => ({ ...prev, [partNumber]: false })));
  }, [activeTab, activeChapterIdx, chapterMeta, parts]);

  // Update editor content when chapter changes
  useEffect(() => {
    const partNumber = extractPartNumber(parts[activeTab]?.title || '');
    const chaptersList = chapters[partNumber] || [];
    const activeIdx = activeSummaryChapterTab[activeTab] ?? 0;
    const chapterKey = `${partNumber}_${chaptersList[activeIdx]?.number}`;
    // Use a timeout to ensure the editor is mounted before setting the value
    setTimeout(() => {
      if (editorInstanceRef.current) {
        editorInstanceRef.current.value(editorContent[chapterKey] ?? chaptersList[activeIdx]?.content ?? '');
      }
    }, 1000);
  }, [activeTab, activeSummaryChapterTab, chapters, parts, editorContent]);

  // Save handler (get value from editor instance)
  const handleSave = async () => {
    setSaveLoading(true);
    setSaveStatus('idle');
    try {
      const partNumber = extractPartNumber(parts[activeTab].title);
      const chaptersList = chapters[partNumber] || [];
      const activeIdx = activeSummaryChapterTab[activeTab] ?? 0;
      const chapterNumber = chaptersList[activeIdx]?.number;
      const chapterKey = `${partNumber}_${chapterNumber}`;
      const content = editorInstanceRef.current ? editorInstanceRef.current.value() : '';
      const res = await fetch('/api/scenes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumber, chapterNumber, content }),
      });
      if (!res.ok) throw new Error('save');
      setEditorContent(prev => ({ ...prev, [chapterKey]: content }));
      setSaveStatus('success');
    } catch (e) {
      setSaveStatus('error');
    } finally {
      setSaveLoading(false);
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
              {/* Display chapters as tabs below summary */}
              {(() => {
                // Get the list of chapters from the part summary
                const chapterTabs = extractChaptersFromSummary(parts[activeTab].summary);
                const activeIdx = activeSummaryChapterTab[activeTab] ?? 0;
                const partNumber = extractPartNumber(parts[activeTab].title);
                const chapterNumber = chapterTabs[activeIdx]?.number;
                // Compute the chapter file path (main chapter file)
                const chapterKey = `${partNumber}_${chapterNumber}`;
                // Load the content for the selected chapter
                const chapterContent = editorContent[chapterKey] ?? '';
                return (
                  <div className="mb-4">
                    <div className="flex gap-2 border-b mb-2">
                      {chapterTabs.map((ch, idx) => (
                        <button
                          key={ch.number}
                          className={`px-3 py-1 border-b-2 ${activeIdx === idx ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
                          onClick={() => setActiveSummaryChapterTab(prev => ({ ...prev, [activeTab]: idx }))}
                          type="button"
                        >
                          {ch.number}
                        </button>
                      ))}
                    </div>
                    <div className="bg-gray-50 p-4 rounded shadow text-center">
                      <div className="text-xs text-gray-500 mb-1">{chapterTabs[activeIdx]?.number}</div>
                      <div className="mb-2 font-bold text-lg">{chapterTabs[activeIdx]?.title}</div>
                      {/* Markdown editor and chat side by side */}
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 text-left">
                          <SimpleMDEEditor
                            key={chapterKey}
                            getMdeInstance={instance => { editorInstanceRef.current = instance; }}
                            options={{
                              spellChecker: false,
                              status: false,
                              toolbar: true,
                            }}
                          />
                          <button
                            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                            type="button"
                            onClick={handleSave}
                            disabled={saveLoading}
                          >
                            {saveLoading ? t('redaction.saving', locale) : t('redaction.save', locale)}
                          </button>
                          {saveStatus === 'success' && (
                            <div className="text-green-600 mt-2">{t('redaction.saveSuccess', locale)}</div>
                          )}
                          {saveStatus === 'error' && (
                            <div className="text-red-600 mt-2">{t('redaction.saveError', locale)}</div>
                          )}
                        </div>
                        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-200 bg-gray-50 p-4">
                          <ChatSidebar locale={locale as 'en' | 'fr'} prompt={chatPrompt} setPrompt={setChatPrompt} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
              {chapterMeta[extractPartNumber(parts[activeTab]?.title || '')]?.length > 0 && (
                <div className="mt-4">
                  <div className="flex gap-2 border-b mb-2">
                    {chapterMeta[extractPartNumber(parts[activeTab].title)].map((ch, idx) => (
                      <button
                        key={ch.title}
                        className={`px-3 py-1 border-b-2 ${activeChapterIdx[activeTab] === idx ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
                        onClick={() => setActiveChapterIdx(prev => ({ ...prev, [activeTab]: idx }))}
                        type="button"
                      >
                        {ch.title}
                      </button>
                    ))}
                  </div>
                  <div className="bg-gray-50 p-4 rounded shadow">
                    <div className="mb-2 font-semibold">{chapterMeta[extractPartNumber(parts[activeTab].title)][activeChapterIdx[activeTab] || 0]?.title}</div>
                    <pre className="whitespace-pre-wrap text-sm mb-2">{chapters[extractPartNumber(parts[activeTab].title)]?.[activeChapterIdx[activeTab] || 0]?.content}</pre>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                      type="button"
                      onClick={async () => {
                        setRedacting(true);
                        setRedactResult(null);
                        try {
                          const partNumber = extractPartNumber(parts[activeTab].title);
                          const idx = activeChapterIdx[activeTab] || 0;
                          const chapterNumber = chapterMeta[partNumber][idx].title;
                          const res = await fetch('/api/redact', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ partNumber, chapterNumberToRedact: chapterNumber }),
                          });
                          if (!res.ok) throw new Error('Redaction failed');
                          const data = await res.json();
                          setRedactResult(data);
                        } catch (e) {
                          setRedactResult({ error: e instanceof Error ? e.message : String(e) });
                        } finally {
                          setRedacting(false);
                        }
                      }}
                      disabled={redacting}
                    >
                      {redacting ? <span className="animate-spin mr-2">⏳</span> : null}
                      {t('redaction.write', locale)}
                    </button>
                    <div className="mt-4">
                      <ChatSidebar locale={locale as 'en' | 'fr'} prompt={chatPrompt} setPrompt={setChatPrompt} />
                    </div>
                  </div>
                </div>
              )}
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