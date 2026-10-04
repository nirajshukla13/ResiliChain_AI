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

/** Landing page per role after signup. */
const ROLE_HOME: Record<UserRole, string> = {
  admin: "/dashboard",
  supply_chain_manager: "/inventory",
  analyst: "/analytics",
};

const DOMAIN_HINTS = [
  { icon: ShieldCheck, color: "text-red-500", domain: "@admin.com", role: "Admin", desc: "Full access — manage users, all CRUD, forecasts & simulations" },
  { icon: Briefcase, color: "text-blue-500", domain: "@manager.com", role: "Manager", desc: "CRUD inventory, suppliers, warehouses, reports + forecasts" },
  { icon: LineChart, color: "text-green-500", domain: "@analyst.com", role: "Analyst", desc: "Read-only analytics, forecasts & simulations" },
];

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const user = await signup(email, password, fullName);
      toast.success("Account created. Welcome to ResiliChain AI.");
      const home = ROLE_HOME[user.role] ?? "/";
      navigate(home, { replace: true });
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Unable to create account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>
          Your role is assigned by email domain. See hints below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              required
              placeholder="Jordan Chen"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@admin.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>

        {/* Domain-based role hints */}
        <Separator className="my-4" />
        <div className="space-y-2">
          <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Role Assignment by Domain
          </p>
          <div className="grid gap-2">
            {DOMAIN_HINTS.map((hint) => (
              <div
                key={hint.domain}
                className="flex items-start gap-2.5 rounded-lg border p-2.5"
              >
                <hint.icon className={`mt-0.5 h-4 w-4 shrink-0 ${hint.color}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {hint.role}{" "}
                    <span className="font-mono font-normal text-muted-foreground">
                      {hint.domain}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{hint.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
