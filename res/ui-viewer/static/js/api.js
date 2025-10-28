import { API_HOST } from './config.js';

const PLATFORM_PATH = 'harmony';

async function checkResponse(response) {
    if (!response.ok) {
        const text = await response.text();
        const message = text || `Server error: ${response.status}`;
        throw new Error(message);
    }
    return response.json();
}

export async function getVersion() {
    const response = await fetch(`${API_HOST}version`);
    return checkResponse(response);
}

export async function listDevices(platform) {
    const response = await fetch(`${API_HOST}${platform}/serials`);
    return checkResponse(response);
}

export async function connectDevice(bundleName) {
    const payload = bundleName ? JSON.stringify({ bundleName }) : '{}';
    const response = await fetch(`${API_HOST}${PLATFORM_PATH}/connect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: payload,
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
