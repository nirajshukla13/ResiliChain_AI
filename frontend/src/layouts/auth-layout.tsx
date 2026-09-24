import { BarChart3, Boxes, Shield, TrendingUp, Zap } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";

/** Centered card shell for the authentication pages with split-screen desktop layout. */
export function AuthLayout() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen auth-gradient-bg relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute top-[-10%] left-[-5%] h-[40%] w-[30%] rounded-full bg-primary/20 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-5%] h-[50%] w-[40%] rounded-full bg-chart-2/20 blur-[100px]" />
      
      {/* Split Layout Container */}
      <div className="flex w-full items-stretch">
        
        {/* Left Side: Branded Hero (Desktop Only) */}
        <div className="hidden lg:flex w-1/2 flex-col justify-center px-16 py-12 relative z-10">
          <div className="max-w-xl">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                <Boxes className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                ResiliChain AI
              </h1>
            </div>
            
            <h2 className="mb-6 text-4xl font-extrabold tracking-tight leading-tight text-foreground">
              Intelligent Supply Chain Forecasting & Resilience Simulator
            </h2>
            
            <p className="mb-10 text-lg text-muted-foreground">
              Empower your enterprise with AI-driven analytics, predictive risk modeling, and seamless digital twin simulations.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-card p-3 shadow-sm border border-border/50 text-chart-1">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Predictive Analytics</h3>
                  <p className="text-sm text-muted-foreground">Forecast demand with high accuracy and low variance.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-card p-3 shadow-sm border border-border/50 text-chart-2">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Risk Mitigation</h3>
                  <p className="text-sm text-muted-foreground">Proactively identify and neutralize network vulnerabilities.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-card p-3 shadow-sm border border-border/50 text-chart-3">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Real-time Responses</h3>
                  <p className="text-sm text-muted-foreground">Respond instantly to disruptions with simulated scenarios.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-card p-3 shadow-sm border border-border/50 text-chart-4">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Comprehensive Reporting</h3>
                  <p className="text-sm text-muted-foreground">Generate deep-dive reports across your entire ecosystem.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-4 py-10 relative z-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex lg:hidden items-center justify-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Boxes className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-base font-semibold">ResiliChain AI</p>
                <p className="text-xs text-muted-foreground">
                  Supply Chain Forecasting &amp; Resilience
                </p>
              </div>
            </div>
            
            <div className="glass-card rounded-xl p-8 shadow-2xl">
              <Outlet />
            </div>
            
            <p className="mt-8 text-center text-xs text-muted-foreground">
              Enterprise supply chain intelligence platform
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
