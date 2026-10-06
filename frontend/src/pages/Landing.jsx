import React from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  Camera,
  TrendingUp,
  Lightbulb,
  Thermometer,
  PieChart,
  FileText,
  Recycle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Leaf,
  BarChart3,
  Clock3,
  Database,
  Users,
  ChevronDown,
} from "lucide-react";

const FEATURES = [
  {
    icon: Boxes,
    title: "Food Inventory Management",
    desc: "Track every food item, category, and storage location in one organized catalog.",
  },
  {
    icon: Sparkles,
    title: "Batch Tracking",
    desc: "Register and monitor individual batches from arrival through expiry.",
  },
  {
    icon: Camera,
    title: "Food Image Analysis",
    desc: "Upload photos for CNN-based classification and computer-vision visual analysis.",
  },
  {
    icon: ShieldCheck,
    title: "Freshness Analysis",
    desc: "A weighted freshness score combining visual condition, storage, shelf life, and age.",
  },
  {
    icon: TrendingUp,
    title: "Shelf-Life Prediction",
    desc: "Transparent, documented estimates of remaining shelf life and risk level.",
  },
  {
    icon: Lightbulb,
    title: "AI Recommendations",
    desc: "Storage, consumption, rotation, and waste-reduction guidance generated from real data.",
  },
  {
    icon: Thermometer,
    title: "Storage Monitoring",
    desc: "Log and review temperature, humidity, and compliance for every location.",
  },
  {
    icon: PieChart,
    title: "Analytics",
    desc: "Inventory, freshness, and storage trends pulled live from the database.",
  },
  {
    icon: FileText,
    title: "Freshness Reports",
    desc: "Detailed, downloadable reports for analyzed food and inventory data.",
  },
  {
    icon: Recycle,
    title: "Waste Reduction",
    desc: "Surface at-risk and expiring inventory before it becomes waste.",
  },
];

const STEPS = [
  {
    n: 1,
    icon: Boxes,
    title: "Register Food",
    desc: "Add food items and organize your catalog.",
  },
  {
    n: 2,
    icon: Database,
    title: "Track Batches",
    desc: "Record quantity, dates, and storage information.",
  },
  {
    n: 3,
    icon: Camera,
    title: "Analyze Freshness",
    desc: "Use image analysis to evaluate visual food condition.",
  },
  {
    n: 4,
    icon: Clock3,
    title: "Predict Shelf Life",
    desc: "Get a transparent estimate of remaining shelf life.",
  },
  {
    n: 5,
    icon: Lightbulb,
    title: "Get Recommendations",
    desc: "Receive storage, rotation, and consumption guidance.",
  },
  {
    n: 6,
    icon: Recycle,
    title: "Reduce Food Waste",
    desc: "Act on at-risk inventory before it becomes waste.",
  },
];

const BENEFITS = [
  "Better inventory visibility across every role",
  "Early identification of food quality issues",
  "Improved storage decisions backed by real readings",
  "Reduced food waste through timely alerts",
  "Data-driven food management, not guesswork",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* =========================================================
          NAVBAR
      ========================================================== */}
      <header className="absolute left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/10 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white shadow-lg shadow-emerald-900/20">
              F
            </span>

            <span className="text-xl font-bold tracking-tight text-white">
              FoodCare
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/90 md:flex">
            <a
              href="#features"
              className="transition hover:text-emerald-300"
            >
              Features
            </a>

            <a
              href="#how-it-works"
              className="transition hover:text-emerald-300"
            >
              How It Works
            </a>

            <a
              href="#benefits"
              className="transition hover:text-emerald-300"
            >
              Benefits
            </a>

            <a
              href="#about"
              className="transition hover:text-emerald-300"
            >
              About
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden text-sm font-medium text-white/90 transition hover:text-emerald-300 sm:block"
            >
              Login
            </Link>

            <Link
              to="/register"
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-400"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* =========================================================
          HERO
      ========================================================== */}
      <section
        className="relative min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/foodcare-hero.png')",
        }}
      >
        {/* Main dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/65 to-slate-900/15" />

        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/50 to-transparent" />

        {/* Green ambient glow */}
        <div className="absolute -left-32 top-40 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />

        {/* Hero content */}
        <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 pb-20 pt-32 sm:px-6 lg:px-8">
          <div className="max-w-3xl text-white">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-lg backdrop-blur-md">
              <Leaf size={16} />
              AI-Powered Freshness Monitoring
            </div>

            {/* Heading */}
            <h1 className="mt-7 text-5xl font-extrabold leading-[1.03] tracking-tight sm:text-6xl lg:text-7xl">
              Know Your Food.
              <br />

              <span className="bg-gradient-to-r from-emerald-300 via-green-300 to-teal-300 bg-clip-text text-transparent">
                Know Its Freshness.
              </span>
            </h1>

            {/* Description */}
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">
              FoodCare helps businesses monitor food freshness, storage
              conditions, shelf life, and inventory quality through one
              intelligent platform.
            </p>

            {/* Buttons */}
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-950/30 transition hover:-translate-y-1 hover:bg-emerald-400"
              >
                Get Started
                <ArrowRight size={17} />
              </Link>

              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/20"
              >
                Explore Features
              </a>
            </div>

            {/* Trust points */}
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-200">
              <span className="flex items-center gap-2">
                <CheckCircle2
                  size={17}
                  className="text-emerald-300"
                />
                Smart monitoring
              </span>

              <span className="flex items-center gap-2">
                <CheckCircle2
                  size={17}
                  className="text-emerald-300"
                />
                Real-time insights
              </span>

              <span className="flex items-center gap-2">
                <CheckCircle2
                  size={17}
                  className="text-emerald-300"
                />
                Waste reduction
              </span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <a
          href="#features"
          className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-xs text-white/70 transition hover:text-white sm:flex"
        >
          <span>Explore</span>
          <ChevronDown size={18} className="animate-bounce" />
        </a>
      </section>

      {/* =========================================================
          FEATURES
      ========================================================== */}
      <section
        id="features"
        className="relative overflow-hidden bg-white py-24"
      >
        <div className="absolute -right-32 top-20 h-72 w-72 rounded-full bg-emerald-50 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Heading */}
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <Sparkles size={14} />
              Platform Features
            </span>

            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to manage freshness
            </h2>

            <p className="mt-4 text-slate-600">
              A complete toolkit for inventory, analysis, prediction,
              monitoring, recommendations, and reporting.
            </p>
          </div>

          {/* Feature cards */}
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-2 hover:border-emerald-100 hover:shadow-xl hover:shadow-emerald-900/5"
                >
                  {/* Number */}
                  <span className="absolute right-5 top-5 text-xs font-bold text-slate-200 transition group-hover:text-emerald-100">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  {/* Icon */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition duration-300 group-hover:bg-emerald-500 group-hover:text-white">
                    <Icon size={21} />
                  </div>

                  <h3 className="mt-5 font-bold text-slate-900">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {feature.desc}
                  </p>

                  <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-emerald-600 opacity-0 transition group-hover:opacity-100">
                    Learn more
                    <ArrowRight size={13} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================
          HOW IT WORKS
      ========================================================== */}
      <section
        id="how-it-works"
        className="relative overflow-hidden bg-slate-50 py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700 shadow-sm">
              Simple Workflow
            </span>

            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              How FoodCare Works
            </h2>

            <p className="mt-4 text-slate-600">
              From registration to waste reduction, FoodCare connects every
              step of the freshness monitoring workflow.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.n}
                  className="group relative rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Connector */}
                  {index < STEPS.length - 1 && (
                    <div className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-500 lg:flex">
                      <ArrowRight size={13} />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-500 group-hover:text-white">
                      <Icon size={20} />
                    </div>

                    <span className="text-3xl font-black text-slate-100">
                      0{step.n}
                    </span>
                  </div>

                  <h3 className="mt-6 font-bold text-slate-900">
                    {step.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================
          PLATFORM OVERVIEW
      ========================================================== */}
      <section className="relative overflow-hidden bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            {/* Left */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <BarChart3 size={14} />
                One Connected Platform
              </span>

              <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Turn food data into better decisions.
              </h2>

              <p className="mt-5 leading-7 text-slate-600">
                FoodCare brings inventory, freshness analysis, storage
                monitoring, shelf-life estimation, recommendations, and
                reporting together in one workflow.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  [
                    ShieldCheck,
                    "Monitor quality",
                    "Identify freshness and storage risks earlier.",
                  ],
                  [
                    TrendingUp,
                    "Understand trends",
                    "Use analytics to understand inventory and freshness.",
                  ],
                  [
                    Recycle,
                    "Reduce waste",
                    "Act on at-risk inventory before it becomes waste.",
                  ],
                ].map(([Icon, title, desc]) => (
                  <div key={title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Icon size={18} />
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900">
                        {title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right dashboard-style preview */}
            <div className="relative">
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 shadow-2xl shadow-slate-900/10">
                {/* Fake browser bar */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />

                  <div className="ml-3 h-2 flex-1 rounded-full bg-white/10" />
                </div>

                {/* Dashboard */}
                <div className="mt-5 rounded-2xl bg-slate-900 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">
                        FoodCare Dashboard
                      </p>
                      <p className="mt-1 text-lg font-bold text-white">
                        Freshness Overview
                      </p>
                    </div>

                    <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                      Live
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["42", "Batches"],
                      ["92%", "Avg. Freshness"],
                      ["94%", "Compliant"],
                      ["5", "At Risk"],
                    ].map(([value, label]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/5 bg-white/5 p-3"
                      >
                        <p className="text-lg font-bold text-white">
                          {value}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Chart */}
                  <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-300">
                        Freshness Distribution
                      </p>

                      <PieChart
                        size={15}
                        className="text-emerald-400"
                      />
                    </div>

                    <div className="mt-5 flex h-28 items-end gap-3">
                      {[72, 88, 62, 94, 78, 100, 84].map(
                        (height, index) => (
                          <div
                            key={index}
                            className="flex flex-1 items-end"
                          >
                            <div
                              className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-300"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating status */}
              <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-xl sm:block">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Thermometer size={18} />
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">
                      Storage
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      4°C · Compliant
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          BENEFITS
      ========================================================== */}
      <section
        id="benefits"
        className="relative overflow-hidden bg-slate-50 py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700 shadow-sm">
                <Users size={14} />
                Built for Every Role
              </span>

              <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Why teams choose FoodCare
              </h2>

              <p className="mt-5 max-w-xl leading-7 text-slate-600">
                Built for administrators, retail managers, warehouse
                operators, quality inspectors, and consumers — everyone
                gets the information they need.
              </p>

              <ul className="mt-8 space-y-4">
                {BENEFITS.map((benefit) => (
                  <li
                    key={benefit}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 size={15} />
                    </span>

                    <span className="text-sm leading-6 text-slate-700">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Stats */}
            <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 p-6 shadow-2xl shadow-emerald-900/10 sm:p-8">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["5", "User Roles"],
                  ["10+", "Platform Features"],
                  ["24/7", "Storage Monitoring"],
                  ["PDF", "Exportable Reports"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/10 p-6 text-center backdrop-blur-sm"
                  >
                    <p className="text-3xl font-extrabold text-white">
                      {value}
                    </p>

                    <p className="mt-2 text-xs font-medium text-emerald-100">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-100">
                    Food monitoring workflow
                  </span>
                  <span className="font-bold text-white">
                    End-to-end
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[92%] rounded-full bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          ABOUT
      ========================================================== */}
      <section
        id="about"
        className="bg-white py-24"
      >
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <Leaf size={14} />
            About FoodCare
          </span>

          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Smarter food management through connected insights
          </h2>

          <p className="mx-auto mt-5 max-w-3xl leading-8 text-slate-600">
            FoodCare is an AI-assisted food freshness monitoring system
            combining inventory management, computer-vision image analysis,
            transparent shelf-life estimation, storage monitoring,
            analytics, and role-based access to support earlier and
            better-informed decisions.
          </p>
        </div>
      </section>

      {/* =========================================================
          CTA
      ========================================================== */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 px-6 py-16 text-center shadow-2xl shadow-emerald-900/10 sm:px-12">
          <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-black/10 blur-3xl" />

          <div className="relative">
            <Leaf
              size={30}
              className="mx-auto text-emerald-100"
            />

            <h2 className="mt-5 text-3xl font-extrabold text-white sm:text-4xl">
              Ready to reduce food waste?
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-emerald-50 sm:text-base">
              Create an account and start monitoring food freshness,
              storage, shelf life, and inventory quality with FoodCare.
            </p>

            <Link
              to="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-emerald-700 shadow-lg transition hover:-translate-y-1 hover:bg-emerald-50"
            >
              Get Started
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
          FOOTER
      ========================================================== */}
      <footer className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 sm:flex-row sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-white">
              F
            </span>

            <span className="font-bold text-slate-900">
              FoodCare
            </span>
          </Link>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
            <a
              href="#features"
              className="transition hover:text-emerald-600"
            >
              Features
            </a>

            <a
              href="#how-it-works"
              className="transition hover:text-emerald-600"
            >
              How It Works
            </a>

            <a
              href="#about"
              className="transition hover:text-emerald-600"
            >
              About
            </a>

            <Link
              to="/login"
              className="transition hover:text-emerald-600"
            >
              Login
            </Link>
          </div>

          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} FoodCare. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}