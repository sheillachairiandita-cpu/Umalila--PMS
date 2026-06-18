import React from 'react';
import { useTranslation } from 'react-i18next';
import { changePublicLanguage } from './publicI18n';

const languageSwitcherStyle = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  zIndex: 2,
};

const languageSelectStyle = {
  padding: '6px 28px 6px 10px',
  fontSize: '0.8rem',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
};

function PublicLanguageSwitcher({ style }) {
  const { i18n } = useTranslation();

  return (
    <div style={{ ...languageSwitcherStyle, ...style }}>
      <select
        value={i18n.language?.startsWith('id') ? 'id' : 'en'}
        onChange={(e) => changePublicLanguage(e.target.value)}
        style={languageSelectStyle}
        aria-label="Language"
      >
        <option value="en">English</option>
        <option value="id">Bahasa Indonesia</option>
      </select>
    </div>
  );
}

export default PublicLanguageSwitcher;
