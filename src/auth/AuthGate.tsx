import { useEffect, useState, type ReactNode } from 'react';
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

  if (!session) {
    return (
      <main className="center">
        <h1>Wedding Sketch</h1>
        <button className="primary" onClick={() =>
          supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })}>
          Google로 로그인
        </button>
      </main>
    );
  }

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
