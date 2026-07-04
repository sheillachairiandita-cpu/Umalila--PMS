import React from 'react';
import { CheckCircle, Calendar, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../i18n/publicI18n';
import PublicLanguageSwitcher from '../../i18n/PublicLanguageSwitcher';
import { Button } from '../ui';
import '../../App.css';

function PublicSuccessMessage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="public-reservation-page public-success-page">
      <main className="public-form-panel">
        <div className="modal-card public-form-card public-success-card" style={{ position: 'relative' }}>
          <PublicLanguageSwitcher />

          <div className="modal-header public-success-header">
            <div className="public-success-icon" aria-hidden="true">
              <CheckCircle size={52} strokeWidth={1.5} />
            </div>
            <h2>{t('success.title')}</h2>
          </div>

          <div className="modal-form public-success-body">
            <p className="public-success-message">{t('success.message')}</p>

            <div className="public-success-steps">
              <div className="form-section public-success-step">
                <h4>
                  <Calendar size={14} />
                  {t('success.bookingVerification')}
                </h4>
                <p className="public-success-step-desc">{t('success.bookingVerificationDesc')}</p>
              </div>

              <div className="form-section public-success-step">
                <h4>
                  <PhoneCall size={14} />
                  {t('success.invoicePayment')}
                </h4>
                <p className="public-success-step-desc">{t('success.invoicePaymentDesc')}</p>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              fullWidth
              size="md"
              onClick={() => navigate('/')}
            >
              {t('success.returnToBooking')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PublicSuccessMessage;
