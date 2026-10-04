import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);
  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setAllowed(undefined);
    if (!userId) return;
    supabase.from('allowed_emails').select('email')
      .then(({ data, error }) => setAllowed(!error && data.length > 0));
  }, [userId]);

  if (session === undefined) return null;

  if (!session) return <Login />;

  if (allowed === undefined) return null;

  if (!allowed) {
    return (
      <main className="center">
        <p>접근 권한이 없는 계정입니다<br /><span className="muted">{session.user.email}</span></p>
        <button onClick={() => supabase.auth.signOut()}>로그아웃</button>
      </main>
    );
  }

  return <>{children(session.user)}</>;
}

// 이메일로 받은 6자리 코드로 로그인. 미리 등록된 계정만 (가입 불가)
function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) setMessage('코드를 보내지 못했어요. 등록된 이메일인지 확인하거나 잠시 후 다시 시도해 주세요');
    else setSent(true);
  };

  // 성공하면 onAuthStateChange가 세션을 넘겨준다
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMessage('코드가 맞지 않거나 만료됐어요');
  };

  return (
    <main className="center">
      <h1>Wedding Sketch</h1>
      {!sent ? (
        <form onSubmit={send}>
          <input type="email" required autoComplete="email" placeholder="이메일"
            value={email} onChange={e => setEmail(e.target.value)} />
          <button className="primary" disabled={busy}>로그인 코드 받기</button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p className="muted">{email}로 보낸 코드를 입력해 주세요</p>
          <input inputMode="numeric" autoComplete="one-time-code" required placeholder="코드"
            value={code} onChange={e => setCode(e.target.value)} />
          <button className="primary" disabled={busy}>로그인</button>
          <button type="button" onClick={() => { setSent(false); setCode(''); setMessage(null); }}>이메일 다시 입력</button>
        </form>
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
