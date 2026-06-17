import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
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

  const hint = selectedHotel.id === "wellness" ? "wellness@ronda.com"
    : selectedHotel.id === "acqua" ? "acqua@ronda.com"
    : selectedHotel.id === "suites" ? "suites@ronda.com"
    : selectedHotel.id === "oceani" ? "oceani@ronda.com" : "";

  return (
    <div className="min-h-screen bg-background">
      <div
        className="safe-top relative px-6 pt-6 pb-24 text-white"
        style={{ background: `linear-gradient(160deg, ${selectedHotel.primaryColor}, ${selectedHotel.primaryColor}aa)` }}
      >
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium opacity-90">
          <ArrowLeft className="h-4 w-4" /> Trocar hotel
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 text-xl font-black backdrop-blur">{selectedHotel.logoText}</div>
          <div>
            <div className="text-xs uppercase tracking-wider opacity-90">Acesso do rondante</div>
            <h1 className="text-xl font-bold">{selectedHotel.name}</h1>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="mx-auto -mt-16 max-w-md space-y-4 px-4">
        <div className="rounded-3xl border bg-card p-5 shadow-lg">
          <h2 className="text-lg font-bold">Entrar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use suas credenciais de rondante.</p>

          <label className="mt-5 block text-sm font-medium">E-mail</label>
          <input
            type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:border-primary"
            placeholder={hint}
          />

          <label className="mt-4 block text-sm font-medium">Senha</label>
          <input
            type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:border-primary"
            placeholder="123456"
          />

          <button
            type="submit" disabled={loading}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: selectedHotel.primaryColor }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
          </button>

          <p className="mt-4 text-xs text-muted-foreground">
            Dica (mock): <strong>{hint}</strong> / senha <strong>123456</strong>
          </p>
        </div>
      </form>
    </div>
  );
}
