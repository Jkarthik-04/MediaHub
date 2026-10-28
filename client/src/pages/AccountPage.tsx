import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../auth/useAuth';
import { ApiError, apiClient } from '../services/api-client';

export function AccountPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [downloaded, setDownloaded] = useState(false);
  const [code, setCode] = useState('');
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/account/backup', { credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json();
        throw new ApiError(response.status, payload.error);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mediahub-backup.json';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setDownloaded(true);
      setMessage(
        'Backup download started. Store the file securely; deleting your account will not delete downloaded copies.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to download your backup.');
    } finally {
      setBusy(false);
    }
  };
  const requestCode = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiClient('/account/deletion-code', { method: 'POST' });
      setRequested(true);
      setMessage('If eligible, a verification code was sent to your registered email.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send verification code.');
    } finally {
      setBusy(false);
    }
  };
  const removeAccount = async () => {
    setBusy(true);
    setError('');
    try {
      await apiClient('/account/delete', { method: 'POST', body: { code, confirm: true } });
      await refresh();
      navigate('/login', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete your account.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Your account" title="Account and data">
        Download a copy of your data or permanently remove your MediaHub account.
      </PageHeader>
      <section className="surface account-section">
        <h2>Download your data</h2>
        <p>
          Your backup contains your profile, library, progress history, recommendations, connected
          service details, and import history. It excludes authentication credentials and provider
          tokens.
        </p>
        <p>
          Store the downloaded file securely. Deleting your account will not delete a copy you
          downloaded.
        </p>
        <button className="button button-primary" disabled={busy} onClick={() => void download()}>
          {busy ? 'Preparing…' : 'Download My Data'}
        </button>
      </section>
      <section className="surface account-section account-danger">
        <h2>Delete account</h2>
        <p>
          Account deletion is permanent and cannot be undone. Your personal records, provider
          connections, imports, and sessions will be removed.
        </p>
        <p>Download your backup before requesting a verification code.</p>
        <button
          className="button button-secondary"
          disabled={!downloaded || busy}
          onClick={() => void requestCode()}
        >
          {busy ? 'Working…' : requested ? 'Resend Verification Code' : 'Request Verification Code'}
        </button>
        {!downloaded && <p className="muted">Start the backup download to enable verification.</p>}
        {requested && (
          <label className="account-code">
            Six-digit code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="profile-message-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="profile-message">
            {message}
          </p>
        )}
        {requested && (
          <div className="control-row">
            <button
              className="button button-danger"
              disabled={busy || code.length !== 6}
              onClick={() => setConfirming(true)}
            >
              Delete My Account
            </button>
          </div>
        )}
        {confirming && (
          <div className="dialog-backdrop" role="presentation">
            <section className="confirmation-dialog" role="alertdialog" aria-modal="true">
              <h2>Delete your account permanently?</h2>
              <p>
                This permanently removes your account and personal data. This action cannot be
                undone.
              </p>
              <div className="dialog-actions">
                <button className="tab" disabled={busy} onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <button
                  className="button button-danger"
                  disabled={busy}
                  onClick={() => void removeAccount()}
                >
                  {busy ? 'Deleting…' : 'Confirm permanent deletion'}
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
