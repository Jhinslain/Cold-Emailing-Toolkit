import React, { useState, useEffect } from 'react';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blockStatus, setBlockStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      
      if (data.success && data.sessionId) {
        localStorage.setItem('sessionId', data.sessionId);
        onLogin();
      } else {
        setError(data.error || 'Erreur inconnue');
        
        // Si bloqué, mettre à jour le statut
        if (data.blocked) {
          setBlockStatus({
            blocked: true,
            remainingMinutes: data.remainingMinutes
          });
        }
      }
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  // Vérifier le statut de blocage au chargement
  useEffect(() => {
    const checkBlockStatus = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/block-status`);
        const data = await res.json();
        if (data.blocked) {
          setBlockStatus(data);
        }
      } catch (err) {
        console.warn('Impossible de vérifier le statut de blocage:', err);
      }
    };
    
    checkBlockStatus();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="glass-card p-8 rounded-xl shadow-xl w-full max-w-sm animate-fade-in">
        <h1 className="text-2xl font-bold text-center mb-6 text-white">Connexion</h1>
        
        {/* Champ username caché pour l'accessibilité */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          style={{ display: 'none' }}
          tabIndex={-1}
        />
        
        <div className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="glass-input w-full px-4 py-2 rounded focus:outline-none"
              placeholder="Entrez votre mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading || blockStatus?.blocked}
              autoFocus={!blockStatus?.blocked}
              autoComplete="current-password"
              required
            />
          </div>
          
          {blockStatus?.blocked && (
            <div className="text-orange-400 text-sm text-center bg-orange-900/20 p-3 rounded border border-orange-500/30">
              <div className="font-semibold mb-1">🚫 Accès temporairement bloqué</div>
              <div>Réessayez dans {blockStatus.remainingMinutes} minutes</div>
              <div className="text-xs mt-1 opacity-75">
                Tentatives utilisées: {blockStatus.attemptsUsed}/5
              </div>
            </div>
          )}
          
          {error && !blockStatus?.blocked && (
            <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="glass-button-primary w-full py-2 rounded mt-2"
            disabled={loading || !password || blockStatus?.blocked}
          >
            {loading ? 'Connexion...' : blockStatus?.blocked ? 'Bloqué' : 'Se connecter'}
          </button>
        </div>
      </form>
    </div>
  );
} 