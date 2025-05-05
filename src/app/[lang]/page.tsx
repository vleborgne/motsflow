'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import BookDescriptionInput from '@/components/BookDescriptionInput';
import BookPlanDisplay from '@/components/BookPlanDisplay';

const steps = [
  {
    id: 1,
    key: 'step1',
  },
  {
    id: 2,
    key: 'step2',
  },
  {
    id: 3,
    key: 'step3',
  },
  {
    id: 4,
    key: 'step4',
  },
];

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [bookDescription, setBookDescription] = useState('');
  const [bookPlan, setBookPlan] = useState<any>(null);
  const pathname = usePathname();
  const locale = pathname.split('/')[1] as 'en' | 'fr';

  useEffect(() => {
    const checkBookPlan = async () => {
      try {
        const response = await fetch(`/${locale}/api/book-plan`);
        const data = await response.json();
        if (data) {
          setBookPlan(data);
          setCurrentStep(2);
        }
      } catch (error) {
        console.error('Error checking book plan:', error);
      }
    };
    checkBookPlan();
  }, [locale]);

  const handleDescriptionChange = (description: string) => {
    setBookDescription(description);
  };

  const handlePlanGenerated = (plan: any) => {
    setBookPlan(plan);
    // Move to the next step when plan is generated
    setCurrentStep(2);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Language Switcher */}
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        {/* Steps Progress */}
        <div className="mb-8">
          <div className="flex justify-between">
            {steps.map((step) => (
              <div key={step.id} className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    currentStep >= step.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step.id}
                </div>
                <div className="mt-2 text-sm font-medium text-gray-700">
                  {t(`steps.${step.key}.title`, locale)}
                </div>
                <div className="text-xs text-gray-500">
                  {t(`steps.${step.key}.description`, locale)}
                </div>
              </div>
            ))}
          </div>
          <div className="relative mt-4">
            <div className="absolute top-0 left-0 h-1 bg-gray-200 w-full"></div>
            <div
              className="absolute top-0 left-0 h-1 bg-blue-600 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">
            {t(`steps.${steps[currentStep - 1].key}.title`, locale)}
          </h2>
          <p className="text-gray-600 mb-6">
            {t(`steps.${steps[currentStep - 1].key}.description`, locale)}
          </p>
          
          {currentStep === 1 && (
            <BookDescriptionInput 
              onDescriptionChange={handleDescriptionChange} 
              onPlanGenerated={handlePlanGenerated}
              locale={locale}
            />
          )}
          
          {currentStep === 2 && (
            <BookPlanDisplay locale={locale} />
          )}
          
          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className={`px-4 py-2 rounded ${
                currentStep === 1
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t('navigation.previous', locale)}
            </button>
            <button
              onClick={() => setCurrentStep((prev) => Math.min(steps.length, prev + 1))}
              disabled={currentStep === steps.length}
              className={`px-4 py-2 rounded ${
                currentStep === steps.length
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {t('navigation.next', locale)}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
} 