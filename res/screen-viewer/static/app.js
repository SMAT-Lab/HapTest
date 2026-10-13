const screen = document.getElementById('screen');
const status = document.getElementById('status');
const empty = document.getElementById('empty');
const target = document.getElementById('target');
const resolution = document.getElementById('resolution');
const reconnectButton = document.getElementById('reconnect');
const RECONNECT_REQUEST_TIMEOUT_MS = 30000;
const RECONNECT_TIMEOUT_MS = 5000;
let reconnectState = 'idle';
let reconnectTimeout;
let reconnectRequestTimeout;
let reconnectAttempt = 0;
let reconnectRequestComplete = false;

function clearReconnectTimeout() {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = undefined;
}

function clearReconnectRequestTimeout() {
    clearTimeout(reconnectRequestTimeout);
    reconnectRequestTimeout = undefined;
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
    if (reconnectState === 'waiting' && !reconnectRequestComplete) return;
    clearReconnectTimeout();
    reconnectState = 'idle';
    reconnectRequestComplete = false;
    reconnectButton.disabled = false;
    empty.hidden = true;
});

screen.addEventListener('error', () => {
    if (reconnectState === 'waiting' && !reconnectRequestComplete) return;
    clearReconnectTimeout();
    reconnectState = 'idle';
    reconnectButton.disabled = false;
    showEmpty('Stream disconnected. Reconnect to try again.');
});

reconnectButton.addEventListener('click', async () => {
    clearReconnectTimeout();
    clearReconnectRequestTimeout();
    const currentAttempt = ++reconnectAttempt;
    const controller = new AbortController();
    let requestTimedOut = false;
    reconnectRequestComplete = false;
    reconnectRequestTimeout = setTimeout(() => {
        requestTimedOut = true;
        controller.abort();
    }, RECONNECT_REQUEST_TIMEOUT_MS);
    reconnectState = 'waiting';
    reconnectButton.disabled = true;
    showEmpty('Reconnecting…');
    try {
        const response = await fetch('/api/reconnect', {
            method: 'POST',
            cache: 'no-store',
            signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
        if (currentAttempt !== reconnectAttempt) return;
        reconnectRequestComplete = true;
        screen.src = `/stream.mjpg?time=${Date.now()}`;
        reconnectTimeout = setTimeout(() => {
            if (reconnectState !== 'waiting' || currentAttempt !== reconnectAttempt) return;
            reconnectState = 'timeout';
            reconnectButton.disabled = false;
            showEmpty('No frame received. The device may be asleep or the stream is unavailable.');
        }, RECONNECT_TIMEOUT_MS);
    } catch (error) {
        if (currentAttempt !== reconnectAttempt) return;
        reconnectState = 'failed';
        reconnectButton.disabled = false;
        showEmpty(requestTimedOut
            ? 'Reconnect request timed out. Check the device connection and try again.'
            : `Reconnect failed: ${error.message}`);
    } finally {
        clearReconnectRequestTimeout();
    }
});

async function refreshStatus() {
    const statusAttempt = reconnectAttempt;
    const startedAfterReconnect = reconnectRequestComplete;
    try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        target.textContent = `Device: ${data.target}`;
        status.className = `status ${data.error ? 'error' : data.streaming ? 'live' : ''}`;
        status.lastElementChild.textContent = data.error
            ? `Stream error: ${data.error}`
            : data.streaming ? 'Native capture session active'
                : 'Starting native stream…';
        if (data.frame?.width && data.frame?.height) {
            resolution.textContent = `${data.frame.width} × ${data.frame.height} · last frame ${new Date(data.frame.receivedAt).toLocaleTimeString()} · ${formatFrameAge(data.frame.ageMs)}`;
        }
        if (startedAfterReconnect && statusAttempt === reconnectAttempt && reconnectRequestComplete && data.frame &&
            (reconnectState === 'waiting' || reconnectState === 'timeout')) {
            clearReconnectTimeout();
            reconnectState = 'idle';
            reconnectRequestComplete = false;
            reconnectButton.disabled = false;
            empty.hidden = true;
        }
        if (reconnectState === 'idle') {
            if (data.error) showEmpty(`Stream error: ${data.error}`);
            else if (data.frame) empty.hidden = true;
            else if (data.streaming) showEmpty('Waiting for the first frame. Change the device screen if it stays blank.');
        }
    } catch (error) {
        status.className = 'status error';
        status.lastElementChild.textContent = `Viewer unavailable: ${error.message}`;
        if (reconnectState === 'idle') showEmpty(`Viewer unavailable: ${error.message}`);
    }
}

refreshStatus();
setInterval(refreshStatus, 1000);
