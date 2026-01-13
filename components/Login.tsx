import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase';
import { CheckSquare, AlertCircle, Loader2 } from 'lucide-react';

interface LoginProps {
  isDark: boolean;
}

const Login: React.FC<LoginProps> = ({ isDark }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      let msg = "Erro ao autenticar.";
      if (err.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
      if (err.code === 'auth/email-already-in-use') msg = "Este e-mail já está cadastrado.";
      if (err.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const bgClass = isDark ? 'bg-slate-900 text-slate-100' : 'bg-babyblue-50 text-slate-800';
  const cardClass = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-100 shadow-xl';
  const inputClass = isDark ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${bgClass}`}>
      <div className={`w-full max-w-md p-8 rounded-2xl border ${cardClass}`}>
        
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-500/30">
             <CheckSquare className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Challenges</h1>
          <p className="text-sm opacity-60">Gerencie suas tarefas com eficiência.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-80">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${inputClass}`}
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-80">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${inputClass}`}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={20} className="animate-spin" />}
            {isRegistering ? 'Criar Conta' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm opacity-70">
            {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="ml-1.5 text-blue-500 hover:text-blue-600 font-semibold underline underline-offset-2"
            >
              {isRegistering ? 'Fazer Login' : 'Cadastre-se'}
            </button>
          </p>
        </div>

      </div>
      
      <p className="mt-8 text-xs text-center opacity-40">
        © 2025 Challenges App. All rights reserved.
      </p>
    </div>
  );
};

export default Login;