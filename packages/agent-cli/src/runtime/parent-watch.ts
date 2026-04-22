export type ParentWatchOptions = {
  pollIntervalMs?: number;
  getPpid?: () => number;
};

export type ParentWatchHandle = {
  stop: () => void;
  ensureAlive: () => boolean;
};

export const watchParent = (
  onParentExit: () => void,
  options: ParentWatchOptions = {},
): ParentWatchHandle => {
  const { pollIntervalMs = 2_000, getPpid = () => process.ppid } = options;
  let stopped = false;
  const startingPpid = getPpid();
  let currentPpid = startingPpid;

  const ensureAlive = (): boolean => {
    if (stopped) {
      return false;
    }
    currentPpid = getPpid();
    if (startingPpid !== 1 && currentPpid === 1) {
      return false;
    }
    return true;
  };

  const timer = setInterval(() => {
    if (!ensureAlive()) {
      clearInterval(timer);
      stopped = true;
      onParentExit();
    }
  }, pollIntervalMs);

  if (typeof (timer as { unref?: () => unknown }).unref === "function") {
    (timer as { unref: () => unknown }).unref();
  }

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    ensureAlive,
  };
};
