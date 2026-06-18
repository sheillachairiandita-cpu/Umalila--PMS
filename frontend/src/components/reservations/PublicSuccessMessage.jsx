import React from 'react';
import { CheckCircle, Calendar, PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '../../i18n/publicI18n';
import PublicLanguageSwitcher from '../../i18n/PublicLanguageSwitcher';

function PublicSuccessMessage() {
  const { t } = useTranslation();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'sans-serif',
      position: 'relative',
    }}>
      <PublicLanguageSwitcher style={{ position: 'fixed' }} />
      <div style={{
        maxWidth: '500px',
        width: '100%',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '40px 32px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <CheckCircle size={56} color="#10b981" strokeWidth={1.5} />
        </div>

        <h2 style={{
          fontSize: '1.6rem',
          color: '#0f172a',
          margin: '0 0 12px 0',
          fontWeight: '600',
          letterSpacing: '-0.02em',
        }}>
          {t('success.title')}
        </h2>

        <p style={{
          fontSize: '0.95rem',
          color: '#64748b',
          lineHeight: '1.6',
          margin: '0 0 32px 0',
        }}>
          {t('success.message')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
            <Calendar size={18} color="#1e3a8a" style={{ marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '0.85rem', color: '#0f172a' }}>{t('success.bookingVerification')}</h4>
              <p style={{ margin: '0', fontSize: '0.8rem', color: '#64748b' }}>{t('success.bookingVerificationDesc')}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
            <PhoneCall size={18} color="#1e3a8a" style={{ marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '0.85rem', color: '#0f172a' }}>{t('success.invoicePayment')}</h4>
              <p style={{ margin: '0', fontSize: '0.8rem', color: '#64748b' }}>{t('success.invoicePaymentDesc')}</p>
            </div>
          </div>
        </div>

        <a
          href="/"
          style={{
            display: 'inline-block',
            width: '100%',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: '600',
            transition: 'background-color 0.2s',
            boxSizing: 'border-box',
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e293b'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#0f172a'; }}
        >
          {t('success.returnToBooking')}
        </a>
      </div>
    </div>
  );
}

export default PublicSuccessMessage;
