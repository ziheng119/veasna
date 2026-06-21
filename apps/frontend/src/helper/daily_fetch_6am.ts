const scheduleDailyFetch = (fetchFn: () => void) => {
  const now = new Date();
  const next6am = new Date();
  next6am.setHours(6, 0, 0, 0);
  if (now >= next6am) {
    next6am.setDate(next6am.getDate() + 1);
  }

  const delay = next6am.getTime() - now.getTime();

  setTimeout(() => {
    fetchFn();

    setInterval(() => {
      fetchFn();
    }, 24 * 60 * 60 * 1000); // every 24 hours
  }, delay);
};
