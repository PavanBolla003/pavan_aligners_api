import dns from "dns/promises";

export default async function domainVerify(domain, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 3000;

  if (!domain || typeof domain !== "string") {
    return { exists: false, method: "none", records: [], error: "invalid-domain" };
  }
  domain = domain.trim().toLowerCase();

  const callWithTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  try {
    // 1. MX lookup
    const mxRecords = await callWithTimeout(dns.resolveMx(domain), timeoutMs);
    if (mxRecords && mxRecords.length > 0) {
      // sort by priority
      mxRecords.sort((a, b) => a.priority - b.priority);
      const exchanges = mxRecords.map(r => ({ exchange: r.exchange, priority: r.priority }));
      return { exists: true, method: "mx", records: exchanges };
    }
  } catch (mxErr) {

  }

  try {
    const aRecords = await callWithTimeout(dns.resolve(domain, "A"), timeoutMs).catch(() => []);
    const aaaaRecords = await callWithTimeout(dns.resolve(domain, "AAAA"), timeoutMs).catch(() => []);

    const addresses = []
      .concat(Array.isArray(aRecords) ? aRecords : [])
      .concat(Array.isArray(aaaaRecords) ? aaaaRecords : []);

    if (addresses.length > 0) {
      return { exists: true, method: "a", records: addresses };
    }

    return { exists: false, method: "none", records: [] };
  } catch (err) {
    return { exists: false, method: "none", records: [], error: err.message || String(err) };
  }
}

