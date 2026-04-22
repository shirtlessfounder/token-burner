#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { runLinkCommand } from "./commands/link.js";
import { runRegisterCommand } from "./commands/register.js";
import { runWhoamiCommand } from "./commands/whoami.js";

type CommandDefinition = {
  description: string;
  run: (args: string[]) => Promise<number> | number;
};

const createPendingCommand =
  (commandName: string): CommandDefinition["run"] =>
  async () => {
    process.stderr.write(
      `${commandName} is not implemented yet. This scaffold only wires the command surface.\n`,
    );

    return 1;
  };

export const commandDefinitions: Record<string, CommandDefinition> = {
  register: {
    description: "claim a code and register this installation",
    run: (args) => runRegisterCommand({ args }),
  },
  link: {
    description: "link this installation to an existing human identity",
    run: (args) => runLinkCommand({ args }),
  },
  burn: {
    description: "start a ceremonial token burn from the CLI",
    run: createPendingCommand("burn"),
  },
  whoami: {
    description: "inspect the locally linked identity context",
    run: () => runWhoamiCommand(),
  },
};

export const formatHelp = (): string => {
  const commandLines = Object.entries(commandDefinitions).map(
    ([commandName, commandDefinition]) =>
      `  ${commandName.padEnd(10)}${commandDefinition.description}`,
  );

  return [
    "token-burner-agent",
    "",
    "Usage:",
    "  token-burner-agent <command>",
    "",
    "Commands:",
    ...commandLines,
    "",
    "Options:",
    "  --help    Show this help output",
  ].join("\n");
};

export const runCli = async (argv: string[] = process.argv.slice(2)) => {
  const [commandName, ...args] = argv;

  if (!commandName || commandName === "--help" || commandName === "help") {
    process.stdout.write(`${formatHelp()}\n`);
    return 0;
  }

  const commandDefinition = commandDefinitions[commandName];

  if (!commandDefinition) {
    process.stderr.write(`Unknown command: ${commandName}\n\n${formatHelp()}\n`);
    return 1;
  }

  if (args.includes("--help")) {
    process.stdout.write(`${commandName}: ${commandDefinition.description}\n`);
    return 0;
  }

  return commandDefinition.run(args);
};

const isMainModule = () => {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPoint).href;
};

if (isMainModule()) {
  const exitCode = await runCli();

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
