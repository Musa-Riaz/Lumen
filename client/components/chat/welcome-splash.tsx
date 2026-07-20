"use client";

import { Sparkle, ArrowRight, MagnifyingGlass, BookOpen, Atom } from "@phosphor-icons/react";

interface WelcomeSplashProps {
  onSelectSuggestion: (topic: string) => void;
}

export function WelcomeSplash({ onSelectSuggestion }: WelcomeSplashProps) {
  const suggestions = [
    {
      title: "History of AI",
      desc: "Detailed report on artificial intelligence from Turing to LLMs.",
      query: "Write a comprehensive report on the history of Artificial Intelligence and its evolution over the decades.",
      icon: Sparkle,
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "SQL vs NoSQL Engines",
      desc: "Compare transactional semantics, scalability, and query efficiency.",
      query: "Perform a deep-dive technical comparison between traditional SQL engines and modern NoSQL databases.",
      icon: BookOpen,
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Quantum Computing Basics",
      desc: "An introduction to qubits, superposition, and entanglement.",
      query: "Explain the fundamental principles of quantum computing, qubits, and quantum superposition for a technical audience.",
      icon: Atom,
      color: "text-purple-500 bg-purple-500/10",
    },
    {
      title: "Evolution of Mars Rovers",
      desc: "A research paper on all Martian robotic missions since Pathfinder.",
      query: "Generate a technical report detailed the design, navigation systems, and discoveries of NASA's Mars rovers since Sojourner.",
      icon: MagnifyingGlass,
      color: "text-amber-500 bg-amber-500/10",
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto space-y-8 select-none">
      {/* Intro Icon & Title */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-2xl mx-auto shadow-md">
          L
        </div>
        <h1 className="text-2xl font-bold tracking-tight mt-4">Welcome to Lumen</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Lumen is an advanced Agentic Deep Research client. Enter a topic, and our multi-agent network (Supervisor, Searcher, Scraper, Critic, Writer) will search, scrape, verify, critique, and compile a structured report for you.
        </p>
      </div>

      {/* Suggested Prompts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSuggestion(s.query)}
            className="flex flex-col text-left p-4 rounded-xl border bg-card hover:bg-accent/40 hover:border-primary/20 transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${s.color}`}>
                  <s.icon size={16} />
                </div>
                <h3 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                  {s.title}
                </h3>
              </div>
              <ArrowRight
                size={14}
                className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              {s.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
