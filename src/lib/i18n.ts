import en from '../translations/en.json';
import fr from '../translations/fr.json';

export type Locale = 'en' | 'fr';

export const translations = {
  en,
  fr,
  bookDescriptionInput: {
    writingStyle: {
      en: 'Writing Style',
      fr: 'Style d\'écriture'
    },
    selectWritingStyle: {
      en: 'Select a writing style',
      fr: 'Sélectionnez un style d\'écriture'
    },
    bookType: {
      en: 'Book Type',
      fr: 'Type d\'ouvrage'
    },
    selectBookType: {
      en: 'Select a book type',
      fr: 'Sélectionnez un type d\'ouvrage'
    },
    description: {
      en: 'Book Description',
      fr: 'Description du livre'
    },
    placeholder: {
      en: 'Enter a detailed description of your book...',
      fr: 'Entrez une description détaillée de votre livre...'
    },
    generatePlan: {
      en: 'Generate Plan',
      fr: 'Générer le Plan'
    },
    generating: {
      en: 'Generating...',
      fr: 'Génération en cours...'
    },
    errors: {
      empty: {
        en: 'Please enter a description',
        fr: 'Veuillez entrer une description'
      },
      noWritingStyle: {
        en: 'Please select a writing style',
        fr: 'Veuillez sélectionner un style d\'écriture'
      },
      noBookType: {
        en: 'Please select a book type',
        fr: 'Veuillez sélectionner un type d\'ouvrage'
      },
      generationFailed: {
        en: 'Failed to generate plan',
        fr: 'Échec de la génération du plan'
      },
      apiKey: {
        en: 'Please check if the OpenAI API key is properly configured in your .env.local file',
        fr: 'Veuillez vérifier que la clé API OpenAI est correctement configurée dans votre fichier .env.local'
      }
    }
  },
};

export function getTranslation(locale: Locale) {
  return translations[locale];
}

export function t(key: string, locale: Locale = 'en'): string {
  const keys = key.split('.');
  let value: unknown = translations[locale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }

  return typeof value === 'string' ? value : key;
} 