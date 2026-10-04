import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  // 계정은 관리자만 만들 수 있으므로 로그인했다면 승인된 사용자
  if (!session) return <Login />;

  return <>{children(session.user)}</>;
}

// 이메일 + 비밀번호 로그인 (브라우저 비밀번호 저장/동기화로 새 기기도 바로). 비밀번호를 모르면 이메일 코드로.
// 계정과 비밀번호는 관리자가 만든다 (가입 불가)
function Login() {
  const [step, setStep] = useState<'password' | 'email' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const go = (next: typeof step) => { setStep(next); setMessage(null); };

  // 성공하면 onAuthStateChange가 세션을 넘겨준다
  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage('이메일 또는 비밀번호가 맞지 않아요');
  };

  // 메일 링크를 눌러도 요청한 주소(로컬/배포)로 돌아오게 emailRedirectTo 지정 (Redirect URLs 허용 목록에 있어야 함)
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: location.origin } });
    setBusy(false);
    if (error?.status === 429) {
      // 한도 초과여도 앞서 보낸 코드는 유효하므로 입력 화면으로 보낸다
      setMessage('메일 발송 한도를 넘었어요. 앞서 받은 코드가 있으면 입력하고, 없으면 잠시 후 다시 시도해 주세요');
      setStep('code');
    } else if (error) setMessage('코드를 보내지 못했어요. 등록된 이메일인지 확인해 주세요');
    else setStep('code');
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMessage('코드가 맞지 않거나 만료됐어요');
  };

  const emailInput = (
    <input type="email" name="email" required autoComplete="username" placeholder="이메일"
      value={email} onChange={e => setEmail(e.target.value)} />
  );

  return (
    <main className="center">
      <h1>Wedding Sketch</h1>
      {step === 'password' && (
        <form onSubmit={signIn}>
          {emailInput}
          <input type="password" name="password" required autoComplete="current-password" placeholder="비밀번호"
            value={password} onChange={e => setPassword(e.target.value)} />
          <button className="primary" disabled={busy}>로그인</button>
          <button type="button" onClick={() => go('email')}>비밀번호 없이 이메일 코드로 로그인</button>
        </form>
      )}
      {step === 'email' && (
        <form onSubmit={send}>
          {emailInput}
          <button className="primary" disabled={busy}>로그인 코드 받기</button>
          <button type="button" onClick={() => go('password')}>비밀번호로 로그인</button>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={verify}>
          <p className="muted">{email}로 보낸 코드를 입력해 주세요</p>
          <input inputMode="numeric" autoComplete="one-time-code" required placeholder="코드"
            value={code} onChange={e => setCode(e.target.value)} />
          <button className="primary" disabled={busy}>로그인</button>
          <button type="button" onClick={() => { setCode(''); go('email'); }}>이메일 다시 입력</button>
        </form>
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
