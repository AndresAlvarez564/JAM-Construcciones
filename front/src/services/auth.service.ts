import {
  signIn, signOut, confirmSignIn,
  resetPassword, confirmResetPassword,
  fetchAuthSession,
} from 'aws-amplify/auth';
import type { Usuario } from '../types';
import config from '../config';

export type LoginResult =
  | { type: 'ok' }
  | { type: 'mfa_code' }
  | { type: 'mfa_setup'; secret: string };

export const login = async (username: string, password: string): Promise<LoginResult> => {
  try { await signOut(); } catch { /* ok */ }

  const { nextStep } = await signIn({
    username,
    password,
    options: { authFlowType: 'USER_PASSWORD_AUTH' },
  });

  if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
    return { type: 'mfa_code' };
  }

  if (nextStep.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
    // El secret viene en el nextStep, no hay que llamar setUpTOTP
    const secret = nextStep.totpSetupDetails.sharedSecret;
    return { type: 'mfa_setup', secret };
  }

  return { type: 'ok' };
};

// Confirmar código MFA (ya configurado) o activar MFA setup — mismo método
export const confirmMfaCode = async (code: string): Promise<void> => {
  await confirmSignIn({ challengeResponse: code });
};

export const forgotPassword = (username: string) =>
  resetPassword({ username });

export const confirmForgotPassword = (username: string, code: string, newPassword: string) =>
  confirmResetPassword({ username, confirmationCode: code, newPassword });

export const getMe = async (): Promise<Usuario> => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  const res = await fetch(`${config.apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('No autorizado');
  return res.json();
};

export const logout = async () => {
  await signOut();
  window.location.href = '/login';
};
