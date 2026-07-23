import figlet from "figlet";
import chalk from "chalk";

export function printBanner(): void {
  const art = figlet.textSync("ATICH", { font: "Slant" });
  console.log(chalk.cyanBright(art));
  console.log(chalk.dim("  terminal WhatsApp client · v1.0.0\n"));
}
