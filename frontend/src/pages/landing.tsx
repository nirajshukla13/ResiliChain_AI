import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Leaf,
  LineChart,
  MousePointerClick,
  Network,
  PackageSearch,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */

function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FloatingElement({
  children,
  duration = 6,
  y = 15,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  duration?: number;
  y?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      animate={{ y: [-y, y, -y] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** 3D tilt card that follows cursor */
function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30 });

  function handleMouse(e: ReactMouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Animated counter */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Data                                                                */
/* ------------------------------------------------------------------ */
const FEATURES = [
  {
    icon: TrendingUp,
    title: "AI-Powered Forecasting",
    desc: "Prophet & XGBoost models trained on real sales data deliver demand forecasts with confidence intervals and SHAP-based explainability.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-500",
    border: "hover:border-blue-500/30",
  },
  {
    icon: Network,
    title: "Digital Twin Network",
    desc: "A live NetworkX graph maps suppliers → factories → warehouses → stores with computed risk scores and real-time health monitoring.",
    gradient: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-500",
    border: "hover:border-purple-500/30",
  },
  {
    icon: Shield,
    title: "Monte Carlo Simulation",
    desc: "Simulate disruptions day-by-day across your network. Paired baselines, 100–5,000 replications, and resilience scoring.",
    gradient: "from-red-500/20 to-orange-500/20",
    iconColor: "text-red-500",
    border: "hover:border-red-500/30",
  },
  {
    icon: Sparkles,
    title: "Smart Recommendations",
    desc: "Transparent rule engine turns real signals — growth × cover, reorder gaps, reliability drops — into actionable decisions.",
    gradient: "from-amber-500/20 to-yellow-500/20",
    iconColor: "text-amber-500",
    border: "hover:border-amber-500/30",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    desc: "8 KPIs, trend charts, supplier heatmaps, cost breakdowns and carbon tracking — all computed from live data, zero randomness.",
    gradient: "from-emerald-500/20 to-green-500/20",
    iconColor: "text-emerald-500",
    border: "hover:border-emerald-500/30",
  },
  {
    icon: BrainCircuit,
    title: "AI Chatbot Assistant",
    desc: "Ask questions in natural language or voice. Gemini-powered assistant queries your data and responds with sourced answers.",
    gradient: "from-pink-500/20 to-rose-500/20",
    iconColor: "text-pink-500",
    border: "hover:border-pink-500/30",
  },
];

const STATS = [
  { value: 541909, suffix: "+", label: "Real Transactions Processed" },
  { value: 300, suffix: "", label: "Products Tracked" },
  { value: 83, suffix: "", label: "Automated Tests Passing" },
  { value: 6, suffix: "", label: "Disruption Scenario Types" },
];

const STEPS = [
  {
    step: "01",
    title: "Import Your Data",
    desc: "Load real sales data (CSV or Excel). The UCI Online Retail dataset with 541K+ genuine UK e-commerce transactions is included out-of-the-box.",
    icon: PackageSearch,
    color: "from-blue-500 to-cyan-500",
  },
  {
    step: "02",
    title: "Train & Forecast",
    desc: "ML models (Prophet, XGBoost) train per-product with chronological validation. Get forecasts with confidence ranges and full explainability.",
    icon: TrendingUp,
    color: "from-purple-500 to-pink-500",
  },
  {
    step: "03",
    title: "Simulate & Act",
    desc: "Run disruption scenarios, explore the digital twin, and follow AI-driven recommendations to build resilience before disruptions hit.",
    icon: Shield,
    color: "from-amber-500 to-red-500",
  },
];

const CAPABILITIES = [
  { text: "JWT authentication with 3 roles", icon: ShieldCheck },
  { text: "Real-time KPI dashboard with 8 metrics", icon: BarChart3 },
  { text: "SHAP-based forecast explainability", icon: BrainCircuit },
  { text: "Monte Carlo simulation engine", icon: Shield },
  { text: "CSV & PDF report generation", icon: LineChart },
  { text: "Carbon emission tracking per mode", icon: Leaf },
  { text: "Full CRUD for inventory & suppliers", icon: PackageSearch },
  { text: "Dark mode with system detection", icon: MousePointerClick },
];

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Navbar ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ rotateY: 180 }}
              transition={{ duration: 0.6 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25"
              style={{ transformStyle: "preserve-3d" }}
            >
              <Boxes className="h-5 w-5" />
            </motion.div>
            <span className="text-lg font-bold tracking-tight">
              Resili<span className="text-primary">Chain</span> AI
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#about" className="transition-colors hover:text-foreground">About</a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">How It Works</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button size="sm" className="rounded-full px-5 shadow-lg shadow-primary/20" asChild>
              <Link to="/signup">
                Get Started <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* 3D Background orbs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <FloatingElement duration={8} y={20} className="absolute -top-20 left-[10%]">
            <div className="h-[400px] w-[400px] rounded-full bg-primary/5 blur-[120px]" />
          </FloatingElement>
          <FloatingElement duration={10} y={25} delay={2} className="absolute top-[20%] right-[5%]">
            <div className="h-[350px] w-[350px] rounded-full bg-chart-2/5 blur-[120px]" />
          </FloatingElement>
          <FloatingElement duration={12} y={15} delay={4} className="absolute bottom-[10%] left-[30%]">
            <div className="h-[300px] w-[300px] rounded-full bg-chart-4/5 blur-[120px]" />
          </FloatingElement>
        </div>

        {/* Floating 3D shapes */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-60">
          <FloatingElement duration={7} y={20} delay={0} className="absolute top-[15%] left-[8%]">
            <motion.div
              animate={{ rotateX: [0, 360], rotateY: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="h-16 w-16 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 to-transparent"
              style={{ transformStyle: "preserve-3d" }}
            />
          </FloatingElement>
          <FloatingElement duration={9} y={18} delay={1} className="absolute top-[25%] right-[12%]">
            <motion.div
              animate={{ rotateZ: [0, 360] }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="h-12 w-12 rounded-full border border-chart-2/15 bg-gradient-to-br from-chart-2/10 to-transparent"
              style={{ transformStyle: "preserve-3d" }}
            />
          </FloatingElement>
          <FloatingElement duration={8} y={22} delay={3} className="absolute bottom-[25%] left-[15%]">
            <motion.div
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              className="h-10 w-10 rounded-lg border border-chart-4/15 bg-gradient-to-br from-chart-4/10 to-transparent"
              style={{ transformStyle: "preserve-3d", perspective: 800 }}
            />
          </FloatingElement>
          <FloatingElement duration={6} y={12} delay={2} className="absolute bottom-[30%] right-[8%]">
            <motion.div
              animate={{ rotateX: [0, 180, 360], rotateZ: [0, 90, 0] }}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              className="h-14 w-14 rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/10 to-transparent"
              style={{ transformStyle: "preserve-3d" }}
            />
          </FloatingElement>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
          <FadeUp>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border bg-card/50 px-5 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
            >
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              AI-Powered Supply Chain Intelligence
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <h1 className="mx-auto max-w-5xl text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              <span className="block">Predict Demand.</span>
              <span className="mt-2 block bg-gradient-to-r from-primary via-chart-2 to-chart-4 bg-clip-text text-transparent">
                Simulate Risk.
              </span>
              <span className="block">Build Resilience.</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.2}>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              ResiliChain AI combines machine learning, Monte Carlo simulation,
              and digital twin technology into one{" "}
              <span className="font-semibold text-foreground">
                complete supply chain intelligence platform
              </span>
              .
            </p>
          </FadeUp>

          <FadeUp delay={0.3}>
            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="rounded-full px-8 text-base shadow-xl shadow-primary/25 h-12" asChild>
                <Link to="/signup">
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 text-base h-12" asChild>
                <a href="#features">
                  Explore Features
                </a>
              </Button>
            </div>
          </FadeUp>

          {/* Scroll indicator */}
          <FadeUp delay={0.5}>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mt-16"
            >
              <div className="mx-auto h-10 w-6 rounded-full border-2 border-muted-foreground/30 p-1">
                <motion.div
                  animate={{ y: [0, 12, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-2 w-2 rounded-full bg-primary"
                />
              </div>
            </motion.div>
          </FadeUp>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <section className="relative border-y bg-card/50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-16 sm:px-6 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <FadeUp key={s.label} delay={i * 0.1}>
              <div className="text-center">
                <p className="text-4xl font-extrabold tracking-tight text-primary lg:text-5xl">
                  <Counter target={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">{s.label}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <FadeUp>
            <div className="text-center">
              <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                Features
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Everything Your Supply Chain Needs
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Six powerful modules working together to transform how you
                manage, predict, and protect your supply chain.
              </p>
            </div>
          </FadeUp>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: 1000 }}>
            {FEATURES.map((f, i) => (
              <FadeUp key={f.title} delay={i * 0.08}>
                <TiltCard className="h-full">
                  <div
                    className={`group relative h-full overflow-hidden rounded-2xl border bg-card p-8 transition-all duration-300 hover:shadow-xl ${f.border}`}
                  >
                    {/* Gradient bg on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

                    <div className="relative z-10">
                      <motion.div
                        whileHover={{ scale: 1.1, rotateZ: 5 }}
                        className={`mb-5 inline-flex rounded-2xl bg-gradient-to-br ${f.gradient} p-3.5`}
                      >
                        <f.icon className={`h-7 w-7 ${f.iconColor}`} />
                      </motion.div>
                      <h3 className="mb-3 text-xl font-bold">{f.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {f.desc}
                      </p>
                    </div>
                  </div>
                </TiltCard>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── What is ResiliChain ────────────────────────────────────── */}
      <section id="about" className="scroll-mt-20 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-muted/20 via-transparent to-muted/20" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <FadeUp>
              <div>
                <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  About the Platform
                </span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  What is{" "}
                  <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                    ResiliChain AI
                  </span>
                  ?
                </h2>
                <div className="mt-8 space-y-5 text-muted-foreground leading-relaxed">
                  <p>
                    ResiliChain AI is an{" "}
                    <span className="font-semibold text-foreground">
                      end-to-end supply chain intelligence platform
                    </span>{" "}
                    that helps teams predict demand, simulate disruptions, and
                    build resilience — all from a single, unified dashboard.
                  </p>
                  <p>
                    Unlike traditional ERP add-ons, it combines{" "}
                    <span className="font-semibold text-foreground">
                      real machine learning
                    </span>{" "}
                    (Prophet & XGBoost with SHAP explainability), a{" "}
                    <span className="font-semibold text-foreground">
                      digital twin graph
                    </span>{" "}
                    built with NetworkX, and a{" "}
                    <span className="font-semibold text-foreground">
                      Monte Carlo simulation engine
                    </span>{" "}
                    that models day-by-day disruption propagation.
                  </p>
                  <p>
                    Every metric you see is computed from real data — no fake
                    numbers, no random generators. Honest ML with transparent evaluation.
                  </p>
                </div>
                <div className="mt-8">
                  <Button className="rounded-full px-6 shadow-lg shadow-primary/20" asChild>
                    <Link to="/signup">
                      Try It Now <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </FadeUp>

            <FadeUp delay={0.2}>
              <div className="grid grid-cols-2 gap-4" style={{ perspective: 800 }}>
                {[
                  { icon: LineChart, label: "Demand Forecasting", desc: "ML models per product", color: "from-blue-500/10 to-blue-500/5" },
                  { icon: Globe2, label: "Digital Twin", desc: "Live network graph", color: "from-purple-500/10 to-purple-500/5" },
                  { icon: Zap, label: "Real-time Alerts", desc: "Critical notifications", color: "from-amber-500/10 to-amber-500/5" },
                  { icon: Truck, label: "Supply Network", desc: "Suppliers to stores", color: "from-emerald-500/10 to-emerald-500/5" },
                  { icon: Leaf, label: "Carbon Tracking", desc: "Per-mode CO₂", color: "from-green-500/10 to-green-500/5" },
                  { icon: ShieldCheck, label: "Resilience Score", desc: "Composite metric", color: "from-red-500/10 to-red-500/5" },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
                    whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    whileHover={{ scale: 1.05, y: -4 }}
                    className={`rounded-2xl border bg-gradient-to-br ${item.color} p-5 text-center shadow-sm backdrop-blur-sm transition-shadow hover:shadow-lg`}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <item.icon className="mx-auto mb-3 h-8 w-8 text-primary" />
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <FadeUp>
            <div className="text-center">
              <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                How It Works
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                From Data to Decisions in 3 Steps
              </h2>
            </div>
          </FadeUp>

          <div className="relative mt-16">
            {/* Connecting line */}
            <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-primary/20 via-primary/40 to-primary/20 lg:block" />

            <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
              {STEPS.map((s, i) => (
                <FadeUp key={s.step} delay={i * 0.15}>
                  <div className="relative" style={{ perspective: 600 }}>
                    <motion.div
                      whileHover={{ rotateY: 5, rotateX: -3, scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                      className="relative overflow-hidden rounded-3xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-xl"
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      {/* Step number badge */}
                      <div className={`absolute -top-px right-6 rounded-b-xl bg-gradient-to-r ${s.color} px-4 py-2`}>
                        <span className="text-sm font-bold text-white">Step {s.step}</span>
                      </div>

                      <motion.div
                        whileHover={{ rotateZ: 10, scale: 1.1 }}
                        className={`mb-6 mt-4 inline-flex rounded-2xl bg-gradient-to-br ${s.color} p-4`}
                      >
                        <s.icon className="h-8 w-8 text-white" />
                      </motion.div>

                      <h3 className="mb-3 text-2xl font-bold">{s.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {s.desc}
                      </p>
                    </motion.div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-muted/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <FadeUp>
              <div>
                <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  Capabilities
                </span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Production-Ready{" "}
                  <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                    Out of the Box
                  </span>
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Every feature is implemented with Clean Architecture, tested
                  with 83 automated tests, and ready for deployment.
                </p>
                <div className="mt-8">
                  <Button variant="outline" className="rounded-full px-6" asChild>
                    <Link to="/signup">
                      See It Live <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </FadeUp>

            <FadeUp delay={0.15}>
              <div className="grid gap-3 sm:grid-cols-2">
                {CAPABILITIES.map((cap, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-3 rounded-xl border bg-card/50 p-3.5 transition-shadow hover:shadow-md"
                  >
                    <div className="rounded-lg bg-primary/10 p-2">
                      <cap.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{cap.text}</span>
                  </motion.div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[140px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-28 text-center sm:px-6">
          <FadeUp>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Ready to Build a{" "}
              <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                Resilient
              </span>{" "}
              Supply Chain?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Sign up in seconds. Import your data. Start forecasting and
              simulating disruptions today.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="rounded-full px-10 text-base shadow-xl shadow-primary/25 h-13" asChild>
                <Link to="/signup">
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-10 text-base h-13" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                  <Boxes className="h-5 w-5" />
                </div>
                <span className="text-lg font-bold">
                  Resili<span className="text-primary">Chain</span> AI
                </span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Intelligent Supply Chain Forecasting & Resilience Simulator.
                Empowering teams with AI-driven insights and disruption preparedness.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="mb-4 text-sm font-semibold">Quick Links</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#about" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a></li>
              </ul>
            </div>

            {/* Get Started */}
            <div>
              <h4 className="mb-4 text-sm font-semibold">Get Started</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link to="/signup" className="hover:text-foreground transition-colors">Create Account</Link></li>
                <li><Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link></li>
              </ul>
            </div>
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} ResiliChain AI. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Built with ❤️ for smarter supply chains
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
