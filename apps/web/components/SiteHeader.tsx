import { HelpButton } from "./HelpButton";
import { ScoreStroke } from "./Marks";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="site-title" href="/">
        Tracinhos
        <ScoreStroke className="brand-mark" />
      </a>
      <HelpButton />
    </header>
  );
}
