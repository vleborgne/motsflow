'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Locale } from '@/lib/i18n';

const locales = ['en', 'fr'] as const;

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1] as Locale;

  const handleLocaleChange = (newLocale: Locale) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="flex space-x-2">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => handleLocaleChange(locale)}
          className={`px-3 py-1 rounded ${
            currentLocale === locale
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
} 