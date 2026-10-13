const screen = document.getElementById('screen');
const status = document.getElementById('status');
const empty = document.getElementById('empty');
const target = document.getElementById('target');
const resolution = document.getElementById('resolution');
const RECONNECT_TIMEOUT_MS = 5000;
let reconnectState = 'idle';
let reconnectTimeout;

function clearReconnectTimeout() {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = undefined;
}

function showEmpty(message) {
    empty.hidden = false;
    empty.textContent = message;
}

function formatFrameAge(ageMs) {
    const seconds = Math.floor(ageMs / 1000);
    return seconds < 1 ? 'just now' : `${seconds}s ago`;
}

screen.addEventListener('load', () => {
    clearReconnectTimeout();
    reconnectState = 'idle';
    empty.hidden = true;
});

screen.addEventListener('error', () => {
    clearReconnectTimeout();
    reconnectState = 'idle';
    showEmpty('Stream disconnected. Reconnect to try again.');
});

document.getElementById('reconnect').addEventListener('click', () => {
    clearReconnectTimeout();
    reconnectState = 'waiting';
    showEmpty('Reconnecting…');
    screen.src = `/stream.mjpg?time=${Date.now()}`;
    reconnectTimeout = setTimeout(() => {
        if (reconnectState !== 'waiting') return;
        reconnectState = 'timeout';
        showEmpty('No frame received. The device may be asleep or the stream is unavailable.');
    }, RECONNECT_TIMEOUT_MS);
});

async function refreshStatus() {
    try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const frameIsStale = Boolean(data.frame?.stale);
        target.textContent = `Device: ${data.target}`;
        status.className = `status ${data.error ? 'error' : frameIsStale ? 'stale' : data.streaming ? 'live' : ''}`;
        status.lastElementChild.textContent = data.error
            ? `Stream error: ${data.error}`
            : data.streaming ? 'Native stream active'
                : frameIsStale ? 'No recent frames · device may be asleep'
                    : 'Starting native stream…';
        if (data.frame?.width && data.frame?.height) {
            resolution.textContent = `${data.frame.width} × ${data.frame.height} · last frame ${new Date(data.frame.receivedAt).toLocaleTimeString()} · ${formatFrameAge(data.frame.ageMs)}`;
        }
        if (reconnectState === 'idle') {
            if (data.error) showEmpty(`Stream error: ${data.error}`);
            else if (frameIsStale) showEmpty('No recent frames. The device screen may be asleep.');
            else if (data.streaming) empty.hidden = true;
        }
    } catch (error) {
        status.className = 'status error';
        status.lastElementChild.textContent = `Viewer unavailable: ${error.message}`;
        if (reconnectState === 'idle') showEmpty(`Viewer unavailable: ${error.message}`);
    }
}

refreshStatus();
setInterval(refreshStatus, 1000);
