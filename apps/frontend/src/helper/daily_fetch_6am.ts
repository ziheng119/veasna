export const scheduleDailyFetch = (fetchFn: () => void): (() => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = () => {
    const now = new Date();
    const next6am = new Date();
    next6am.setHours(6, 0, 0, 0);
    if (now >= next6am) {
      next6am.setDate(next6am.getDate() + 1);
    }

    const delay = next6am.getTime() - now.getTime();

    timeoutId = setTimeout(() => {
      fetchFn();
      scheduleNext();
    }, delay);
  };

  scheduleNext();

  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
};
