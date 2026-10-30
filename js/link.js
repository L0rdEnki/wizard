// Display mode: one-way link from the controlling phone to a display tablet over WebRTC (PeerJS).
// PeerJS is only loaded when the link is used; pairing needs its public broker, game data goes peer to peer.

const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
const PEER_PREFIX = 'wizard-tracker-';
const RETRY_MS = 3000;
const PING_MS = 4000;
const SILENCE_MS = 12000;
const PING = 'ping';

const CODE_PATTERN = /^\d{4}$/;

export const randomCode = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');

export const linkUrl = (code, base) => {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('display', code);
  return url.href;
};

// Accepts a bare code or a scanned/opened link; anything else gives null.
export const parseLinkCode = text => {
  const value = String(text ?? '').trim();
  if (CODE_PATTERN.test(value)) return value;
  try {
    const code = new URL(value).searchParams.get('display');
    return CODE_PATTERN.test(code ?? '') ? code : null;
  } catch {
    return null;
  }
};

const loading = {};
export const loadScript = src => {
  loading[src] = loading[src] || new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => {
      delete loading[src];
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(script);
  });
  return loading[src];
};

// Phone side. onStatus gets { code, state: 'starting' | 'waiting' | 'connected' | 'offline' }.
// A resumed code is kept even if the broker still reports it as taken by our previous session.
export const hostLink = ({ code: resumedCode, onStatus, onConnect }) => {
  let code = resumedCode || randomCode();
  let keepCode = Boolean(resumedCode);
  let peer = null;
  let closed = false;
  let retryTimer = null;
  const connections = new Set();

  const report = state => {
    const open = [...connections].some(c => c.open);
    onStatus({ code, state: state || (open ? 'connected' : 'waiting') });
  };

  const retry = () => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(start, RETRY_MS);
  };

  const accept = conn => {
    conn.on('open', () => {
      connections.add(conn);
      report();
      onConnect();
    });
    const drop = () => {
      connections.delete(conn);
      if (!closed) report();
    };
    conn.on('close', drop);
    conn.on('error', drop);
  };

  async function start() {
    if (closed) return;
    report(peer ? 'offline' : 'starting');
    try {
      await loadScript(PEERJS_URL);
    } catch {
      report('offline');
      retry();
      return;
    }
    if (closed) return;
    if (peer) peer.destroy();
    connections.clear();
    peer = new window.Peer(PEER_PREFIX + code);
    peer.on('open', () => {
      keepCode = true;
      report();
    });
    peer.on('connection', accept);
    peer.on('disconnected', () => {
      if (!closed && !peer.destroyed) peer.reconnect();
    });
    peer.on('error', err => {
      if (closed) return;
      if (err.type === 'unavailable-id' && !keepCode) code = randomCode();
      report('offline');
      retry();
    });
  }

  const send = text => {
    connections.forEach(conn => {
      if (conn.open) conn.send(text);
    });
  };

  // Lets the tablet notice a silently dead channel, e.g. after the phone was locked.
  const pingTimer = setInterval(() => send(PING), PING_MS);

  start();

  return {
    send,
    // Call when the app returns to the foreground.
    resume() {
      if (closed || !peer) return;
      if (peer.destroyed) start();
      else if (peer.disconnected) peer.reconnect();
    },
    close() {
      closed = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      if (peer) peer.destroy();
    }
  };
};

// Tablet side. onStatus gets 'connecting' | 'connected' | 'lost'; the last snapshot stays on screen while lost.
export const joinLink = (code, { onStatus, onSnapshot }) => {
  let peer = null;
  let conn = null;
  let closed = false;
  let connected = false;
  let lastSign = Date.now();

  const setLost = () => {
    connected = false;
    onStatus('lost');
  };

  const connect = () => {
    if (closed || !peer || !peer.open) return;
    if (conn) conn.close();
    lastSign = Date.now();
    const current = peer.connect(PEER_PREFIX + code, { serialization: 'json', reliable: true });
    conn = current;
    current.on('data', raw => {
      if (current !== conn) return;
      lastSign = Date.now();
      if (!connected) {
        connected = true;
        onStatus('connected');
      }
      if (raw === PING) return;
      try {
        onSnapshot(JSON.parse(raw));
      } catch {
        // Ignore anything that isn't a snapshot.
      }
    });
    current.on('close', () => {
      if (current === conn && !closed) setLost();
    });
  };

  const startPeer = async () => {
    try {
      await loadScript(PEERJS_URL);
    } catch {
      return;
    }
    if (closed) return;
    if (peer) peer.destroy();
    peer = new window.Peer();
    peer.on('open', connect);
    peer.on('disconnected', () => {
      if (!closed && !peer.destroyed) peer.reconnect();
    });
    peer.on('error', () => {
      if (!closed && connected) setLost();
    });
  };

  // Covers every failure the same way: without a sign of life, try again.
  const watchdog = setInterval(() => {
    if (Date.now() - lastSign < SILENCE_MS) return;
    if (connected) setLost();
    lastSign = Date.now();
    if (peer && peer.open) connect();
    else startPeer();
  }, RETRY_MS);

  onStatus('connecting');
  startPeer();

  return {
    close() {
      closed = true;
      clearInterval(watchdog);
      if (peer) peer.destroy();
    }
  };
};
