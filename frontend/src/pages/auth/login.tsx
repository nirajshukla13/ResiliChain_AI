import { Loader2, ShieldCheck, Briefcase, LineChart } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/services/api";
import type { UserRole } from "@/types";

/** Landing page per role after login. */
const ROLE_HOME: Record<UserRole, string> = {
  admin: "/dashboard",
  supply_chain_manager: "/inventory",
  analyst: "/analytics",
};

const DEMO_CREDENTIALS = [
  {
    role: "Admin",
    email: "admin@admin.com",
    password: "admin123",
    icon: ShieldCheck,
    color: "text-red-500",
    bg: "bg-red-500/10 hover:bg-red-500/20",
  },
  {
    role: "Manager",
    email: "manager@manager.com",
    password: "manager123",
    icon: Briefcase,
    color: "text-blue-500",
    bg: "bg-blue-500/10 hover:bg-blue-500/20",
  },
  {
    role: "Analyst",
    email: "analyst@analyst.com",
    password: "analyst123",
    icon: LineChart,
    color: "text-green-500",
    bg: "bg-green-500/10 hover:bg-green-500/20",
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(email, password);
      const home = ROLE_HOME[user.role] ?? "/";
      navigate(home, { replace: true });
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Unable to sign in.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fillCredentials = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Access your supply chain intelligence workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>

        {/* Demo credentials */}
        <Separator className="my-4" />
        <div className="space-y-2">
          <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Demo Credentials
          </p>
          <div className="grid gap-2">
            {DEMO_CREDENTIALS.map((cred) => (
              <button
                key={cred.role}
                type="button"
                onClick={() => fillCredentials(cred.email, cred.password)}
                className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${cred.bg}`}
              >
                <cred.icon className={`h-4 w-4 shrink-0 ${cred.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{cred.role}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {cred.email} · {cred.password}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-[10px] text-muted-foreground">
            Click a role above to auto-fill credentials
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
