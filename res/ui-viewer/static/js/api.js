import { API_HOST } from './config.js';

const PLATFORM_PATH = 'harmony';

async function checkResponse(response) {
    if (!response.ok) {
        const text = await response.text();
        try {
            const payload = JSON.parse(text);
            if (payload && payload.message) {
                throw new Error(payload.message);
            }
        } catch (_ignored) {
            // ignore JSON parse errors, fall back to raw text
        }
        const message = text || `Server error: ${response.status}`;
        throw new Error(message);
    }
    return response.json();
}

export async function getVersion() {
    const response = await fetch(`${API_HOST}version`);
    return checkResponse(response);
}

export async function listDevices() {
    const response = await fetch(`${API_HOST}${PLATFORM_PATH}/devices`);
    return checkResponse(response);
}

export async function connectDevice(connectKey, bundleName) {
    const payload = {};
    if (bundleName) {
        payload.bundleName = bundleName;
    }
    if (connectKey) {
        payload.connectKey = connectKey;
    }
    const body = Object.keys(payload).length ? JSON.stringify(payload) : '{}';
    const response = await fetch(`${API_HOST}${PLATFORM_PATH}/connect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body,
    });
    return checkResponse(response);
}

export async function fetchScreenshot() {
    const response = await fetch(`${API_HOST}${PLATFORM_PATH}/screenshot`);
    return checkResponse(response);
}

export async function fetchHierarchy() {
    const response = await fetch(`${API_HOST}${PLATFORM_PATH}/hierarchy`);
    return checkResponse(response);
}

export async function fetchXpathLite(nodeId) {
    const response = await fetch(`${API_HOST}${PLATFORM_PATH}/hierarchy/xpathLite`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ node_id: nodeId }),
    });
    return checkResponse(response);
}
