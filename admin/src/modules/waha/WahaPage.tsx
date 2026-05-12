'use client';

import { useState, useEffect, useCallback } from 'react';
import { Smartphone, RotateCw, LogOut, QrCode, ExternalLink, Shield } from 'lucide-react';
import Button from '@/components/ui/Button';

interface SessionInfo {
  name: string;
  status: string;
  me?: { name: string; pushName: string; wid: string } | null;
}

const WAHA_DASHBOARD_URL = 'http://20.21.104.27:3000';
const WAHA_DASHBOARD_USERNAME = 'admin';
const WAHA_DASHBOARD_PASSWORD = 'HSC-WAHA-Login-2026!';

export default function WahaPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchQrCode = useCallback(async () => {
    setQrLoading(true);
    try {
      const res = await fetch(`/api/waha/qr?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('QR not available');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setQrData((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrl;
      });
    } catch {
      setQrData(null);
    } finally {
      setQrLoading(false);
    }
  }, []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/waha', { cache: 'no-store' });
      if (res.ok) {
        const sessions = await res.json();
        const s = sessions?.[0] || null;
        setSession(s);
        if (s?.status === 'SCAN_QR_CODE') {
          await fetchQrCode();
        } else {
          setQrData((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } else {
        setError('WAHA service not reachable');
      }
    } catch {
      setError('Failed to connect to WhatsApp service');
    } finally {
      setLoading(false);
    }
  }, [fetchQrCode]);

  const startSession = async () => {
    setError('');
    const res = await fetch('/api/waha/start', { method: 'POST' });
    if (res.ok) {
      setTimeout(loadSession, 2000);
    } else {
      setError('Failed to start session');
    }
  };

  const logoutSession = async () => {
    setError('');
    await fetch('/api/waha/logout', { method: 'POST' });
    setTimeout(loadSession, 2000);
  };

  useEffect(() => {
    loadSession();
    return () => {
      if (qrData) URL.revokeObjectURL(qrData);
    };
  }, [loadSession]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'CONNECTED': return 'var(--color-success)';
      case 'SCAN_QR_CODE':
      case 'STARTING': return 'var(--color-warning)';
      default: return 'var(--color-error)';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'CONNECTED': return 'Connected';
      case 'SCAN_QR_CODE': return 'Waiting for QR Scan';
      case 'STARTING': return 'Starting...';
      case 'STOPPED': return 'Not Connected';
      default: return status;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            WhatsApp Connection
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Connect or disconnect your WhatsApp number for the bot
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {session?.status === 'SCAN_QR_CODE' && (
            <Button leftIcon={<RotateCw size={15} />} onClick={fetchQrCode} loading={qrLoading}>
              Refresh QR
            </Button>
          )}
          {session?.status === 'CONNECTED' && (
            <Button leftIcon={<LogOut size={15} />} variant="danger" onClick={logoutSession}>
              Disconnect
            </Button>
          )}
          {(!session || session?.status === 'STOPPED') && (
            <Button leftIcon={<Smartphone size={15} />} onClick={startSession}>
              Start Session
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm" style={{
          background: 'var(--color-error-bg)',
          color: 'var(--color-error-text)',
          border: '1px solid var(--color-error-border)'
        }}>
          {error}
        </div>
      )}

      <div className="rounded-xl p-6" style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)'
      }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: statusColor(session?.status || 'STOPPED'), opacity: 0.2 }}>
            <Smartphone size={24} style={{ color: statusColor(session?.status || 'STOPPED') }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {session?.me?.pushName || 'WhatsApp'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: statusColor(session?.status || 'STOPPED') + '20',
                  color: statusColor(session?.status || 'STOPPED')
                }}>
                {loading ? 'Checking…' : statusLabel(session?.status || 'STOPPED')}
              </span>
            </div>
            {session?.me?.wid && (
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {session.me.wid}
              </p>
            )}
          </div>
        </div>

        {(session?.status === 'SCAN_QR_CODE') && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr] items-start">
            <div className="flex flex-col items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--color-page-bg)' }}>
              <div className="text-center mb-1">
                <QrCode size={48} style={{ color: 'var(--color-text-muted)' }} className="mx-auto mb-2" />
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Scan this QR code with WhatsApp
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Open WhatsApp → Linked Devices → Link a Device
                </p>
              </div>

              {qrData ? (
                <img
                  src={qrData}
                  alt="WhatsApp QR"
                  className="rounded-xl bg-white p-2"
                  style={{ width: '100%', maxWidth: 280, height: 'auto', aspectRatio: '1', border: '2px solid var(--color-card-border)' }}
                />
              ) : (
                <div
                  className="rounded-xl flex items-center justify-center text-center p-4"
                  style={{ width: '100%', maxWidth: 280, aspectRatio: '1', background: 'var(--color-input-bg)', border: '2px solid var(--color-card-border)' }}
                >
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {qrLoading ? 'Loading QR…' : 'QR preview unavailable here. Use the WAHA dashboard login on the right.'}
                  </p>
                </div>
              )}

              <p className="text-xs mt-1 text-center" style={{ color: 'var(--color-text-muted)' }}>
                QR expires quickly. If it stops working, refresh it.
              </p>
            </div>

            <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--color-page-bg)', border: '1px solid var(--color-card-border)' }}>
              <div className="flex items-center gap-2">
                <Shield size={18} style={{ color: 'var(--color-accent)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  WAHA Dashboard Fallback
                </h3>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                If the QR preview does not render well inside the admin panel, open the WAHA dashboard directly and link the number there.
              </p>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Dashboard URL</p>
                  <a
                    href={WAHA_DASHBOARD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 break-all"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {WAHA_DASHBOARD_URL}
                    <ExternalLink size={14} />
                  </a>
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Username</p>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{WAHA_DASHBOARD_USERNAME}</p>
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Password</p>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{WAHA_DASHBOARD_PASSWORD}</p>
                </div>
              </div>

              <div className="text-sm rounded-lg p-3" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', color: 'var(--color-text-muted)' }}>
                Recommended: try the QR here first. If it misbehaves, use the dashboard link and finish pairing there without getting blocked.
              </div>
            </div>
          </div>
        )}

        {session?.status === 'CONNECTED' && (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'var(--color-success)', opacity: 0.15 }}>
                <Smartphone size={32} style={{ color: 'var(--color-success)' }} />
              </div>
              <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                WhatsApp Connected
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                The bot is ready to receive and send messages
              </p>
            </div>
          </div>
        )}

        {(!session || session?.status === 'STOPPED') && (
          <div className="flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'var(--color-text-muted)', opacity: 0.1 }}>
                <Smartphone size={32} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Not Connected
              </p>
              <p className="text-sm mt-1 mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Start a session to connect your WhatsApp number.
              </p>
              <div className="text-left rounded-xl p-4" style={{ background: 'var(--color-page-bg)', border: '1px solid var(--color-card-border)' }}>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Direct WAHA login</p>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>URL: <a href={WAHA_DASHBOARD_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>{WAHA_DASHBOARD_URL}</a></p>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Username: {WAHA_DASHBOARD_USERNAME}</p>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Password: {WAHA_DASHBOARD_PASSWORD}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

