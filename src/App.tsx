import { AuthGate } from './auth/AuthGate';

export default function App() {
  return <AuthGate>{user => <main className="center">{user.email} 로그인됨</main>}</AuthGate>;
}
