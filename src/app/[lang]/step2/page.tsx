import BookPlanDisplay from '@/components/BookPlanDisplay';
import { t } from '@/lib/i18n';

interface Step2PageProps {
  params: {
    lang: 'en' | 'fr';
  };
}

export default function Step2Page({ params }: Step2PageProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">{t('steps.step2.title', params.lang)}</h1>
      <p className="text-gray-600 mb-8">{t('steps.step2.description', params.lang)}</p>
      <BookPlanDisplay locale={params.lang} />
    </div>
  );
} 