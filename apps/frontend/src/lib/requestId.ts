// One-off ids for saves the host must apply only once, even when the device sends them again
// because it never got the answer (e.g. the Wi-Fi dropped after the host saved).

// 32 hex characters. crypto.randomUUID needs HTTPS; getRandomValues also works over plain http
// on the clinic LAN.
export function newRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

// The id for one save: the same id is sent again after a failure (the host may have saved it),
// and a new one is made once the host confirms. `key` names what is being saved (e.g. drug and
// quantity): a different key is a different save, so it gets a new id.
export function retryableRequestId() {
  let id: string | null = null;
  let idFor = "";
  return {
    get: (key = "") => {
      if (key !== idFor) { id = null; idFor = key; }
      return (id ??= newRequestId());
    },
    saved: () => { id = null; },
    // Carries on with an id sent earlier (e.g. kept in a draft across a reload): the host may have
    // saved that registration already.
    resume: (earlierId: string | null, key = "") => { id = earlierId; idFor = key; },
  };
}
