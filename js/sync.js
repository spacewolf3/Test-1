/* Sync across devices through a file in a private GitHub repo.
   Each device keeps its own access token (never synced or exported). A sync
   reads the repo's copy, merges it with this device's copy item by item
   (newest change wins, deletions stick), saves the result here, and writes it
   back to GitHub if anything changed. */
(function () {
  const CONFIG_KEY = "personal-paper.sync"; // {repo: "owner/name", token, lastSyncAt, lastError}
  const FILE = "paper.json";
  const API = "https://api.github.com";
  const PUSH_DELAY = 15000; // wait for a pause in editing before writing to GitHub

  let busy = null;
  let pushTimer = null;
  let applyingRemote = false;
  const statusListeners = [];

  // ------------------------------------------------------------------ config
  function config() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || null; } catch { return null; }
  }
  function setConfig(c) {
    if (c) localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CONFIG_KEY);
    notify();
  }
  const enabled = () => { const c = config(); return !!(c && c.repo && c.token); };

  let status = { state: enabled() ? "idle" : "off", message: "" };
  function setStatus(state, message = "") { status = { state, message }; notify(); }
  function notify() { statusListeners.forEach((fn) => fn(status, config())); }

  // ------------------------------------------------------------------ GitHub API
  async function gh(path, { method = "GET", body, token } = {}) {
    const c = config();
    const res = await fetch(`${API}${path}`, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token || c.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return { status: 404 };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(explain(res.status, data.message));
      err.status = res.status;
      throw err;
    }
    return { status: res.status, data };
  }

  function explain(status, message) {
    if (status === 401) return "GitHub didn't accept the access token. It may have expired or been mistyped.";
    if (status === 403) return "The token isn't allowed to write to that repo. Check it has Contents: Read and write.";
    if (status === 409 || status === 422) return "conflict";
    return `GitHub error ${status}${message ? `: ${message}` : ""}`;
  }

  // UTF-8 safe base64, in chunks so large papers don't overflow the call stack.
  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromBase64(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function readRemote() {
    const c = config();
    const r = await gh(`/repos/${c.repo}/contents/${FILE}`);
    if (r.status === 404) return { sha: null, state: null };
    let b64 = r.data.content;
    // Files over 1 MB come back without content; fetch the blob instead (up to 100 MB).
    if (!b64 || r.data.encoding === "none") b64 = (await gh(`/repos/${c.repo}/git/blobs/${r.data.sha}`)).data.content;
    return { sha: r.data.sha, state: JSON.parse(fromBase64(b64)) };
  }

  function deviceName() {
    const ua = navigator.userAgent;
    return /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "browser";
  }

  async function writeRemote(st, sha) {
    const c = config();
    const r = await gh(`/repos/${c.repo}/contents/${FILE}`, {
      method: "PUT",
      body: { message: `Update from ${deviceName()}`, content: toBase64(JSON.stringify(st, null, 1)), ...(sha ? { sha } : {}) },
    });
    return r.data.content.sha;
  }

  // ------------------------------------------------------------------ merge
  function stampOf(st, key, item) {
    return (st.stamps && st.stamps[key]) || (item && (item.updatedAt || item.publishedAt || item.addedAt)) || 0;
  }

  /** Merge two copies. For each item the most recent change wins; a deletion wins
      over anything older than it. On an exact tie the repo's copy wins. */
  function merge(local, remote) {
    const L = Store.normalize(local), R = Store.normalize(remote);
    const out = Store.normalize({ ...L, stamps: {}, deleted: {} });

    const decide = (key, li, ri) => {
      const ls = li !== undefined ? stampOf(L, key, li) : -1;
      const rs = ri !== undefined ? stampOf(R, key, ri) : -1;
      const [item, stamp] = rs >= ls ? [ri, rs] : [li, ls];
      const del = Math.max(L.deleted[key] || 0, R.deleted[key] || 0);
      if (del && del >= stamp) { out.deleted[key] = del; return undefined; }
      if (item !== undefined && stamp > 0) out.stamps[key] = stamp;
      return item;
    };

    for (const [field, kind] of Object.entries(Store.LISTS)) {
      const lm = new Map(L[field].map((x) => [x.id, x]));
      const rm = new Map(R[field].map((x) => [x.id, x]));
      const ids = [...new Set([...lm.keys(), ...rm.keys()])];
      out[field] = ids.map((id) => decide(`${kind}:${id}`, lm.get(id), rm.get(id))).filter(Boolean);
    }
    out.topics.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    for (const [field, kind] of Object.entries(Store.MAPS)) {
      out[field] = {};
      for (const k of new Set([...Object.keys(L[field]), ...Object.keys(R[field])])) {
        const v = decide(`${kind}:${k}`, L[field][k], R[field][k]);
        if (v !== undefined) out[field][k] = v;
      }
    }
    for (const field of Store.OBJECTS) out[field] = decide(`${field}:`, L[field], R[field]) || L[field];
    out.seen = [...new Set([...R.seen, ...L.seen])].slice(-5000);

    // Keep deletion records for items that no longer exist anywhere, so they stay deleted.
    for (const st of [L, R]) for (const [k, t] of Object.entries(st.deleted)) if (!(k in out.stamps)) out.deleted[k] = Math.max(out.deleted[k] || 0, t);
    return out;
  }

  const comparable = (st) => JSON.stringify(Store.normalize(st || {}));

  // ------------------------------------------------------------------ sync
  /** Pull, merge, push. Returns true if this device's data changed. */
  function sync() {
    if (!enabled()) return Promise.resolve(false);
    if (busy) return busy;
    clearTimeout(pushTimer);
    busy = (async () => {
      setStatus("syncing");
      let changedHere = false;
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const remote = await readRemote();
          const local = Store.state;
          const merged = remote.state ? merge(local, remote.state) : Store.normalize(local);
          if (comparable(merged) !== comparable(local)) {
            applyingRemote = true;
            Store.replaceState(merged);
            applyingRemote = false;
            changedHere = true;
          }
          if (!remote.state || comparable(merged) !== comparable(remote.state)) {
            try { await writeRemote(Store.state, remote.sha); }
            catch (e) { if (e.message === "conflict") continue; throw e; } // another device wrote first: merge again
          }
          setConfig({ ...config(), lastSyncAt: Date.now(), lastError: "" });
          setStatus("ok");
          return changedHere;
        }
        throw new Error("Couldn't sync because another device kept saving at the same moment. Try again.");
      } catch (e) {
        const msg = e.name === "TypeError" ? "Couldn't reach GitHub. Are you online?" : e.message;
        if (config()) setConfig({ ...config(), lastError: msg });
        setStatus("error", msg);
        return changedHere;
      } finally {
        applyingRemote = false;
        busy = null;
      }
    })();
    return busy;
  }

  // Push edits after a short pause, and right away when the app is hidden or closed.
  Store.onSave(() => {
    if (!enabled() || applyingRemote) return;
    setStatus("pending");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(sync, PUSH_DELAY);
  });

  document.addEventListener("visibilitychange", () => {
    if (!enabled()) return;
    if (document.visibilityState === "hidden") { if (status.state === "pending") sync(); }
    else pullAndRefresh(); // coming back to the app: pick up changes from other devices
  });
  window.addEventListener("online", () => enabled() && pullAndRefresh());

  async function pullAndRefresh() {
    const changed = await sync();
    // Redraw with the new data, unless the person is typing (that would steal their cursor).
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (changed && !typing && window.App && App.refresh) App.refresh();
  }

  // ------------------------------------------------------------------ connect / disconnect
  /** Check the repo and token, then do the first sync. */
  async function connect(repoInput, token) {
    const repo = repoInput.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Enter the repo as owner/name, for example spacewolf3/my-paper-data.");
    const r = await gh(`/repos/${repo}`, { token: token.trim() });
    if (r.status === 404) throw new Error("Couldn't find that repo. Check the name, and that the token was given access to it.");
    if (!r.data.private) throw new Error("That repo is public, so anyone could read your paper. Make it private (or pick a private repo) and try again.");
    if (r.data.permissions && !r.data.permissions.push) throw new Error("The token can read the repo but not save to it. Give it Contents: Read and write.");
    setConfig({ repo, token: token.trim(), lastSyncAt: 0, lastError: "" });
    const changed = await sync();
    if (status.state === "error") throw new Error(status.message);
    return changed;
  }

  function disconnect() {
    clearTimeout(pushTimer);
    setConfig(null);
    setStatus("off");
  }

  window.Sync = {
    enabled, config, connect, disconnect, sync, pullAndRefresh, merge,
    get status() { return status; },
    onStatus(fn) { statusListeners.push(fn); fn(status, config()); },
  };
})();
