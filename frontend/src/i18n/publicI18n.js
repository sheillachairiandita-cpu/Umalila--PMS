import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import id from './locales/id.json';

export const PUBLIC_LANG_STORAGE_KEY = 'umalila-public-lang';

const savedLang = localStorage.getItem(PUBLIC_LANG_STORAGE_KEY);
const initialLang = savedLang === 'id' ? 'id' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    id: { translation: id },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function changePublicLanguage(lng) {
  localStorage.setItem(PUBLIC_LANG_STORAGE_KEY, lng);
  i18n.changeLanguage(lng);
}

export default i18n;
