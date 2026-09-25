import type { Metadata } from "next";
import { RulesContent } from "@/components/RulesContent";

export const metadata: Metadata = {
  title: "Regras — Tracinhos",
};

export default function RegrasPage() {
  return (
    <main className="page">
      <header className="brand">
        <h1>Regras</h1>
        <p>Como se joga Tracinhos.</p>
      </header>
      <RulesContent />
      <a className="btn" href="/">
        Voltar ao lobby
      </a>
    </main>
  );
}
