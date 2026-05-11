import { intro as clackIntro, outro as clackOutro } from "@clack/prompts";
import { theme } from "../ui/theme.ts";

export function showIntro(): void {
  clackIntro(theme.brand("turbocraft"));
}

export function showOutro(message: string): void {
  clackOutro(theme.muted(message));
}
