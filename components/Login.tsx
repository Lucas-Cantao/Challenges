import React, { useState, useMemo } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase';
import { CheckSquare, AlertCircle, Loader2, Check, X } from 'lucide-react';

interface LoginProps {
  isDark: boolean;
}

const Login: React.FC<LoginProps> = ({ isDark }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Password Requirements Logic
  const passwordRequirements = useMemo(() => [
    { id: 'length', label: 'Mínimo de 8 caracteres', test: (p: string) => p.length >= 8 },
    { id: 'upper', label: 'Uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
    { id: 'lower', label: 'Uma letra minúscula', test: (p: string) => /[a-z]/.test(p) },
    { id: 'number', label: 'Um número', test: (p: string) => /[0-9]/.test(p) },
    { id: 'special', label: 'Um caractere especial (@$!%*?&)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
  ], []);

  const isPasswordValid = useMemo(() => {
    if (!isRegistering) return true; // Only validate strictly on registration
    return passwordRequirements.every(req => req.test(password));
  }, [password, isRegistering, passwordRequirements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegistering && !isPasswordValid) {
        setError("A senha não atende aos requisitos de segurança.");
        return;
    }

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
      if (err.code === 'auth/weak-password') msg = "A senha é muito fraca.";
      if (err.code === 'auth/too-many-requests') msg = "Muitas tentativas falhas. Tente novamente mais tarde.";
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
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${inputClass}`}
              placeholder="••••••••"
            />
          </div>

          {/* Password Strength Indicators - Only shown during Registration */}
          {isRegistering && (
             <div className={`p-4 rounded-xl text-xs space-y-2 border transition-all animate-in fade-in slide-in-from-top-2
                ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-100'}
             `}>
                <p className="font-semibold mb-2 opacity-80">Sua senha deve conter:</p>
                {passwordRequirements.map((req) => {
                    const met = req.test(password);
                    return (
                        <div key={req.id} className={`flex items-center gap-2 transition-colors ${met ? 'text-green-500' : 'text-gray-400'}`}>
                            {met ? <Check size={14} strokeWidth={3} /> : <X size={14} />}
                            <span className={met ? 'opacity-100 font-medium' : 'opacity-70'}>{req.label}</span>
                        </div>
                    );
                })}
             </div>
          )}

          <button
            type="submit"
            disabled={loading || (isRegistering && !isPasswordValid)}
            className={`w-full font-semibold py-3.5 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2
               ${loading || (isRegistering && !isPasswordValid)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500 shadow-none' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
               }
            `}
          >
            {loading && <Loader2 size={20} className="animate-spin" />}
            {isRegistering ? 'Criar Conta Segura' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm opacity-70">
            {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
            <button
              onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
              }}
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