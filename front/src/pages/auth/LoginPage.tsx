import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { login, confirmMfaCode, forgotPassword, confirmForgotPassword } from '../../services/auth.service';
import useAuth from '../../hooks/useAuth';

type Step = 'login' | 'mfa_code' | 'mfa_setup' | 'forgot' | 'forgot_confirm';

export default function LoginPage() {
  const navigate = useNavigate();
  const { refetch } = useAuth();

  const [step, setStep] = useState<Step>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [secret, setSecret] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [forgotUser, setForgotUser] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const setErr = (msg: string) => { setError(msg); setLoading(false); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await login(username, password);
      if (result.type === 'mfa_code') {
        setStep('mfa_code');
        setLoading(false);
      } else if (result.type === 'mfa_setup') {
        // El secret viene directo de Amplify, solo generamos el QR
        setSecret(result.secret);
        const uri = `otpauth://totp/JAM:${encodeURIComponent(username)}?secret=${result.secret}&issuer=JAM%20Construcciones`;
        setQrUrl(await QRCode.toDataURL(uri));
        setStep('mfa_setup');
        setLoading(false);
      } else {
        await refetch();
        navigate('/dashboard');
      }
    } catch (e) {
      console.error('LOGIN ERROR:', e);
      setErr('Usuario o contraseña incorrectos');
    }
  };

  const handleMfaCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await confirmMfaCode(mfaCode);
      await refetch();
      navigate('/dashboard');
    } catch {
      setErr('Código incorrecto o expirado');
    }
  };

  // Setup: confirmSignIn con el código activa el MFA y completa el login
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await confirmMfaCode(setupCode);
      await refetch();
      navigate('/dashboard');
    } catch {
      setErr('Código incorrecto. Verifica tu autenticador.');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await forgotPassword(forgotUser);
      setStep('forgot_confirm');
      setLoading(false);
    } catch {
      setErr('No se pudo enviar el código. Verifica el usuario.');
    }
  };

  const handleForgotConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await confirmForgotPassword(forgotUser, forgotCode, newPassword);
      setStep('login');
      setLoading(false);
    } catch {
      setErr('Código incorrecto o contraseña inválida.');
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h2 style={s.title}>JAM Construcciones</h2>
        {error && <div style={s.error}>{error}</div>}

        {step === 'login' && (
          <form onSubmit={handleLogin}>
            <input style={s.input} placeholder="Usuario" value={username}
              onChange={e => setUsername(e.target.value)} autoComplete="username" required />
            <input style={s.input} type="password" placeholder="Contraseña" value={password}
              onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
            <button style={s.link} type="button" onClick={() => { setError(''); setStep('forgot'); }}>
              Olvidé mi contraseña
            </button>
          </form>
        )}

        {step === 'mfa_code' && (
          <form onSubmit={handleMfaCode}>
            <p style={s.hint}>Ingresa el código de 6 dígitos de tu autenticador.</p>
            <input style={{ ...s.input, letterSpacing: 8, textAlign: 'center' }}
              placeholder="000000" value={mfaCode} onChange={e => setMfaCode(e.target.value)}
              maxLength={6} autoFocus required />
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
            <button style={s.link} type="button" onClick={() => { setError(''); setStep('login'); }}>
              Volver
            </button>
          </form>
        )}

        {step === 'mfa_setup' && (
          <form onSubmit={handleSetup}>
            <p style={s.hint}>Escanea el QR con Google Authenticator o Authy e ingresa el código.</p>
            {qrUrl && <img src={qrUrl} alt="QR MFA" style={s.qr} />}
            <p style={s.label}>Clave manual:</p>
            <code style={s.secret}>{secret}</code>
            <input style={{ ...s.input, letterSpacing: 6, textAlign: 'center' }}
              placeholder="Código del autenticador" value={setupCode}
              onChange={e => setSetupCode(e.target.value)} maxLength={6} autoFocus required />
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Activando...' : 'Activar MFA y entrar'}
            </button>
          </form>
        )}

        {step === 'forgot' && (
          <form onSubmit={handleForgot}>
            <p style={s.hint}>Ingresa tu usuario y te enviaremos un código a tu correo.</p>
            <input style={s.input} placeholder="Usuario" value={forgotUser}
              onChange={e => setForgotUser(e.target.value)} required />
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
            <button style={s.link} type="button" onClick={() => { setError(''); setStep('login'); }}>
              Volver al login
            </button>
          </form>
        )}

        {step === 'forgot_confirm' && (
          <form onSubmit={handleForgotConfirm}>
            <p style={s.hint}>Ingresa el código que recibiste y tu nueva contraseña.</p>
            <input style={s.input} placeholder="Código de verificación" value={forgotCode}
              onChange={e => setForgotCode(e.target.value)} maxLength={6} required />
            <input style={s.input} type="password" placeholder="Nueva contraseña" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} required />
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
            <button style={s.link} type="button" onClick={() => { setError(''); setStep('login'); }}>
              Volver al login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' },
  card: { background: '#fff', borderRadius: 8, padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  title: { textAlign: 'center', marginBottom: 24, fontSize: 22, fontWeight: 600 },
  input: { display: 'block', width: '100%', padding: '10px 12px', marginBottom: 12, borderRadius: 6, border: '1px solid #d9d9d9', fontSize: 15, boxSizing: 'border-box' },
  btn: { display: 'block', width: '100%', padding: '10px 0', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, cursor: 'pointer', marginTop: 4 },
  link: { display: 'block', width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#1677ff', cursor: 'pointer', fontSize: 14 },
  error: { background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '8px 12px', marginBottom: 16, color: '#cf1322', fontSize: 14 },
  hint: { color: '#555', marginBottom: 16, fontSize: 14 },
  qr: { display: 'block', margin: '0 auto 16px', width: 160, height: 160 },
  label: { fontSize: 12, color: '#888', marginBottom: 4 },
  secret: { display: 'block', background: '#f5f5f5', borderRadius: 4, padding: '6px 10px', marginBottom: 16, wordBreak: 'break-all', fontSize: 13 },
};
