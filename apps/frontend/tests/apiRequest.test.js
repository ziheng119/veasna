// Requests to the host on unreliable Wi-Fi (lib/api/request.ts).
const { apiFetch, readError } = require('../src/lib/api/request');
const { useUserStore } = require('../src/stores/useUserStore');

let originalFetch;
beforeEach(() => { originalFetch = global.fetch; });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); useUserStore.setState({ user: null }); });

// A fetch that never answers until its signal is aborted, like a request lost on the Wi-Fi.
const hangingFetch = () => jest.fn((_url, { signal }) => new Promise((_resolve, reject) => {
  const abort = () => reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort);
}));

test('a request with no answer gives up after the timeout with a readable message', async () => {
  jest.useFakeTimers();
  global.fetch = hangingFetch();
  const read = apiFetch('http://host/api/queue', { timeoutMs: 5000 });
  const saved = apiFetch('http://host/api/visits', { method: 'POST', timeoutMs: 5000 });
  jest.advanceTimersByTime(5000);
  await expect(read).rejects.toThrow('The host laptop took too long to answer. Check the Wi-Fi, then try again.');
  // A save that got no answer may still have reached the host: staff are told to check first.
  await expect(saved).rejects.toThrow('The host laptop took too long to answer, so this may not have been saved. Check the Wi-Fi and what was saved before trying again.');
  await expect(saved).rejects.toMatchObject({ name: 'NoAnswerError' });
});

test('a dropped connection reads as a message, not "Failed to fetch"', async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(apiFetch('http://host/api/queue')).rejects.toThrow("Couldn't reach the host laptop. Check the Wi-Fi, then try again.");
  await expect(apiFetch('http://host/api/visits/dental/1', { method: 'POST' })).rejects.toThrow("Couldn't reach the host laptop, so this may not have been saved.");
});

test("cancelling still rejects with the browser's AbortError, which live lists ignore", async () => {
  global.fetch = hangingFetch();
  const controller = new AbortController();
  const request = apiFetch('http://host/api/queue', { signal: controller.signal });
  controller.abort();
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  // Already cancelled before it started.
  await expect(apiFetch('http://host/api/queue', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
});

test('a 401 on a signed-in request signs the device out; a wrong password at sign-in does not', async () => {
  useUserStore.setState({ user: { id: 1, username: 'admin', role: 'admin', token: 't' } });
  global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 401 }));
  await apiFetch('http://host/api/auth/login', { method: 'POST', body: '{}' });
  expect(useUserStore.getState().user).not.toBeNull();
  const res = await apiFetch('http://host/api/queue', { headers: { Authorization: 'Bearer t' } });
  expect(res.status).toBe(401);
  expect(useUserStore.getState().user).toBeNull();
});

test("error messages come from the host's reply, whatever its format", async () => {
  const reply = (body, status = 400) => new Response(body, { status });
  expect(await readError(reply('{"error":"Weight must be a number."}'), 'Failed')).toBe('Weight must be a number.');
  expect(await readError(reply('{"message":"Invalid username or password"}', 401), 'Failed')).toBe('Invalid username or password');
  // The rate limit answers in plain text.
  expect(await readError(reply('Too many requests from this IP, please try again later.', 429), 'Failed'))
    .toBe('Too many requests from this IP, please try again later.');
  expect(await readError(reply('<html><body>Bad gateway</body></html>', 502), 'Failed to save')).toBe('Failed to save (502)');
  expect(await readError(reply('', 500), 'Failed to save')).toBe('Failed to save (500)');
  expect(await readError(reply('PayloadTooLargeError', 413), 'Failed')).toBe('This is too large for the host laptop to save.');
});
