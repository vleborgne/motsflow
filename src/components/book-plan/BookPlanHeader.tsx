import { t } from '@/lib/i18n';

interface BookPlanHeaderProps {
  title: string;
  genre: string;
  locale: 'en' | 'fr';
  onTitleUpdate: (title: string) => void;
  onGenreUpdate: (genre: string) => void;
  onModifyPlan: (prompt: string) => void;
}

export default function BookPlanHeader({ 
  title, 
  genre, 
  locale, 
  onTitleUpdate, 
  onGenreUpdate,
  onModifyPlan 
}: BookPlanHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <input
          type="text"
          defaultValue={title}
          onBlur={(e) => onTitleUpdate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onTitleUpdate(e.currentTarget.value);
            }
          }}
          className="text-2xl font-bold text-center border rounded px-2 py-1"
        />
        <input
          type="text"
          defaultValue={genre}
          onBlur={(e) => onGenreUpdate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onGenreUpdate(e.currentTarget.value);
            }
          }}
          className="text-gray-600 text-center border rounded px-2 py-1 mt-2"
        />
      </div>
      <div className="flex flex-col items-center">
        <textarea
          placeholder={t('bookPlanDisplay.modifyPlanPrompt', locale)}
          className="w-full max-w-2xl border rounded px-4 py-2"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onModifyPlan(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
        />
        <button
          onClick={(e) => {
            const textarea = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
            onModifyPlan(textarea.value);
            textarea.value = '';
          }}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {t('bookPlanDisplay.modifyPlan', locale)}
        </button>
      </div>
    </div>
  );
} 