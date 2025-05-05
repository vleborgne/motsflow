import { t } from '@/lib/i18n';
import { BookPlan } from './types';

interface BookPlanCharactersProps {
  characters: BookPlan['characters'];
  locale: 'en' | 'fr';
  onCharacterUpdate: (characterId: string, updates: Partial<BookPlan['characters'][0]>) => void;
}

export default function BookPlanCharacters({ characters, locale, onCharacterUpdate }: BookPlanCharactersProps) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-xl font-semibold mb-4">{t('bookPlanDisplay.characters', locale)}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {characters.map((character) => (
          <div key={character.id} className="border rounded p-3">
            <div className="space-y-2">
              <input
                type="text"
                defaultValue={character.name}
                onBlur={(e) => onCharacterUpdate(character.id, { name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onCharacterUpdate(character.id, { name: e.currentTarget.value });
                  }
                }}
                className="font-medium border rounded px-2 py-1 w-full"
              />
              <textarea
                defaultValue={character.description}
                onBlur={(e) => onCharacterUpdate(character.id, { description: e.target.value })}
                className="text-gray-600 border rounded px-2 py-1 w-full"
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 