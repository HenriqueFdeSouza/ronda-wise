import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail, Lock, ShieldCheck } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { authService } from "@/services/authService";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "RondaCheck — Login" }] }),
  component: Login,
});

function Login() {
  const { selectedHotel, setSession } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!selectedHotel) return <Navigate to="/" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const s = await authService.login(email, password, selectedHotel.id);
      setSession(s);
      toast.success(`Bem-vindo(a), ${s.user.name.split(" ")[0]}!`);
      navigate({ to: "/start" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no login";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const hint = `${selectedHotel.id}@ronda.com`;

  return (
    <div className="min-h-screen bg-background">
      <div
        className="safe-top relative overflow-hidden px-6 pt-6 pb-28 text-white"
        style={{
          background: `linear-gradient(160deg, ${selectedHotel.primaryColor} 0%, ${selectedHotel.primaryColor}e6 60%, #0fb5c4 140%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <Link to="/" className="relative inline-flex items-center gap-2 text-sm font-medium opacity-90">
          <ArrowLeft className="h-4 w-4" /> Trocar hotel
        </Link>
        <div className="relative mt-8 flex items-center gap-3">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-2xl font-black backdrop-blur-sm ring-1 ring-white/20">
            {selectedHotel.logoText}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">RondaCheck</div>
            <h1 className="truncate text-xl font-bold">{selectedHotel.name}</h1>
            <p className="mt-0.5 text-xs text-white/80">Acesso do rondante</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="mx-auto -mt-20 max-w-md space-y-4 px-4">
        <div className="rounded-3xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Entrar</h2>
              <p className="text-xs text-muted-foreground">Use suas credenciais de rondante.</p>
            </div>
          </div>

          <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail</label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-xl border bg-background pl-10 pr-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder={hint}
            />
          </div>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Senha</label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl border bg-background pl-10 pr-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${selectedHotel.primaryColor}, #0fb5c4)` }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
          </button>

          <div className="mt-5 rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Acesso de teste:</span> {hint} · senha <span className="font-mono font-semibold">123456</span>
          </div>
        </div>
      </form>
    </div>
  );
}
