import ChapterDevelopment from '@/components/ChapterDevelopment';
import { t } from '@/lib/i18n';

interface Step3PageProps {
  params: {
    lang: 'en' | 'fr';
  };
}

export default function Step3Page({ params }: Step3PageProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">{t('steps.step3.title', params.lang)}</h1>
      <p className="text-gray-600 mb-8">{t('steps.step3.description', params.lang)}</p>
      <ChapterDevelopment />
    </div>
  );
} 