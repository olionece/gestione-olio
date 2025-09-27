"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthBox() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) alert(error.message); else setSent(true);
  };

  if (sent) return <p className="text-sm">Controlla la tua email per il link di accesso.</p>;

  return (
    <div className="max-w-sm space-y-2">
      <input
        className="w-full border rounded p-2"
        placeholder="you@email.com"
        value={email}
        onChange={(e)=>setEmail(e.target.value)}
      />
      <button className="w-full rounded-xl p-2 border" onClick={signIn}>
        Accedi via email
      </button>
    </div>
  );
}
