'use client';

import { useState, useEffect } from 'react';
import { t } from '@/lib/i18n';
import { writingStyles, bookTypes } from '@/lib/bookOptions';

interface BookDescriptionInputProps {
  onDescriptionChange: (description: string) => void;
  onPlanGenerated: (plan: any) => void;
  locale: 'en' | 'fr';
}

interface UserInputs {
  description: string;
  writingStyle: string;
  bookType: string;
}

export default function BookDescriptionInput({ 
  onDescriptionChange, 
  onPlanGenerated,
  locale 
}: BookDescriptionInputProps) {
  const [description, setDescription] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [bookType, setBookType] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Load saved inputs on component mount
  useEffect(() => {
    const loadInputs = async () => {
      try {
        const response = await fetch(`/api/book-config`);
        if (!response.ok) throw new Error('Failed to load config');
        const data: UserInputs = await response.json();
        setDescription(data.description);
        setWritingStyle(data.writingStyle);
        setBookType(data.bookType);
        onDescriptionChange(data.description);
      } catch (error) {
        console.error('Error loading saved inputs:', error);
      }
    };
    loadInputs();
  }, []);

  const saveInputs = async () => {
    try {
      const inputs: UserInputs = {
        description,
        writingStyle,
        bookType
      };
      const response = await fetch(`/api/book-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputs),
      });
      if (!response.ok) throw new Error('Failed to save config');
    } catch (error) {
      console.error('Error saving inputs:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
    onDescriptionChange(newDescription);
    setError(null);
    setErrorDetails(null);
    saveInputs();
  };

  const handleWritingStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setWritingStyle(e.target.value);
    saveInputs();
  };

  const handleBookTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBookType(e.target.value);
    saveInputs();
  };

  const handleGeneratePlan = async () => {
    if (!description.trim()) {
      setError(t('bookDescriptionInput.errors.empty'));
      return;
    }

    if (!writingStyle) {
      setError(t('bookDescriptionInput.errors.noWritingStyle'));
      return;
    }

    if (!bookType) {
      setError(t('bookDescriptionInput.errors.noBookType'));
      return;
    }

    setIsGenerating(true);
    setError(null);
    setErrorDetails(null);

    try {
      const response = await fetch(`/${locale}/api/book-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          description,
          writingStyle,
          bookType,
          lang: locale
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('bookDescriptionInput.errors.generationFailed'));
      }

      if (data.error) {
        if (data.error.includes('API key')) {
          setErrorDetails(t('bookDescriptionInput.errors.apiKey'));
        }
        throw new Error(data.error);
      }

      onPlanGenerated(data.plan);
    } catch (err) {
      console.error('Error generating plan:', err);
      setError(err instanceof Error ? err.message : t('bookDescriptionInput.errors.generationFailed'));
      if (err instanceof Error && err.message.includes('API key')) {
        setErrorDetails(t('bookDescriptionInput.errors.apiKey'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="writing-style" className="block text-sm font-medium text-gray-700 mb-1">
            {t('bookDescriptionInput.writingStyle', locale)}
          </label>
          <select
            id="writing-style"
            value={writingStyle}
            onChange={handleWritingStyleChange}
            className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('bookDescriptionInput.selectWritingStyle', locale)}</option>
            {writingStyles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label[locale]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="book-type" className="block text-sm font-medium text-gray-700 mb-1">
            {t('bookDescriptionInput.bookType', locale)}
          </label>
          <select
            id="book-type"
            value={bookType}
            onChange={handleBookTypeChange}
            className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('bookDescriptionInput.selectBookType', locale)}</option>
            {bookTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label[locale]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="book-description" className="block text-sm font-medium text-gray-700 mb-1">
          {t('bookDescriptionInput.description', locale)}
        </label>
        <textarea
          id="book-description"
          value={description}
          onChange={handleChange}
          className="w-full h-64 p-4 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          placeholder={t('bookDescriptionInput.placeholder', locale)}
        />
      </div>

      {(error || errorDetails) && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error && <p className="font-medium">{error}</p>}
          {errorDetails && <p className="mt-2 text-sm">{errorDetails}</p>}
        </div>
      )}

      <button
        onClick={handleGeneratePlan}
        disabled={isGenerating || !description.trim() || !writingStyle || !bookType}
        className={`w-full py-2 px-4 rounded-lg transition-colors ${
          isGenerating || !description.trim() || !writingStyle || !bookType
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isGenerating ? t('bookDescriptionInput.generating', locale) : t('bookDescriptionInput.generatePlan', locale)}
      </button>
    </div>
  );
} 