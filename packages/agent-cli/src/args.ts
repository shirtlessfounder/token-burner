export type ParsedArgs = {
  flags: Record<string, string>;
  positional: string[];
};

export class CliArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliArgsError";
  }
}

export const parseArgs = (argv: string[]): ParsedArgs => {
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const body = token.slice(2);
      const eqIndex = body.indexOf("=");
      if (eqIndex >= 0) {
        const key = body.slice(0, eqIndex);
        const value = body.slice(eqIndex + 1);
        if (!key) {
          throw new CliArgsError(`invalid flag: ${token}`);
        }
        flags[key] = value;
        continue;
      }
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[body] = "true";
        continue;
      }
      flags[body] = next;
      index += 1;
    } else {
      positional.push(token);
    }
  }

  return { flags, positional };
};

export const requireFlag = (
  flags: Record<string, string>,
  name: string,
): string => {
  const value = flags[name];
  if (!value) {
    throw new CliArgsError(`missing required flag: --${name}`);
  }
  return value;
};
