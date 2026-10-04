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
    if (error?.status === 429) setMessage('메일 발송 한도를 넘었어요. 이미 받은 코드가 있으면 그걸 쓰고, 없으면 잠시 후 다시 시도해 주세요');
    else if (error) setMessage('코드를 보내지 못했어요. 등록된 이메일인지 확인해 주세요');
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
