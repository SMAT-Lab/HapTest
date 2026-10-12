export type AgentArchitecture = 'arm64' | 'x86_64';
export type AgentTransport = 'tcp' | 'unix';

export interface AgentProfile {
    architecture: AgentArchitecture;
    transport: AgentTransport;
    version: string;
    fileName: string;
}

const UNIX_SOCKET_BASE_VERSION = '6.0.2.1';
const AGENT_VERSION_1_1_10_BASE = '5.1.1.3';
const AGENT_VERSION_1_1_5_BASE = '5.1.1.2';

function numericVersion(version: string, description: string): number[] {
    const match = version.match(/\d+(?:\.\d+){2,3}/);
    if (!match) {
        throw new Error(`Unable to parse ${description} version from "${version}".`);
    }
    return match[0].split('.').map(Number);
}

export function compareVersions(left: string, right: string): number {
    const leftParts = numericVersion(left, 'left');
    const rightParts = numericVersion(right, 'right');
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index++) {
        const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
        if (difference !== 0) {
            return difference > 0 ? 1 : -1;
        }
    }
    return 0;
}

export function detectAgentArchitecture(uitestFileInfo: string): AgentArchitecture {
    if (/x86_64|x86-64/i.test(uitestFileInfo)) {
        return 'x86_64';
    }
    if (/aarch64|arm64/i.test(uitestFileInfo)) {
        return 'arm64';
    }
    throw new Error(`Unsupported uitest binary architecture: ${uitestFileInfo.trim() || 'unknown'}.`);
}

export function selectAgentProfile(uitestVersion: string, architecture: AgentArchitecture): AgentProfile {
    // xdevice-devicetest 6.1.0.210 selects the x86_64 build independently of
    // uitest version and socket mode.
    if (architecture === 'x86_64') {
        return { architecture, transport: 'tcp', version: '1.1.9', fileName: 'uitest_agent_v1.1.9.x86_64_so' };
    }

    if (compareVersions(uitestVersion, UNIX_SOCKET_BASE_VERSION) > 0) {
        return { architecture, transport: 'unix', version: '1.2.2', fileName: 'uitest_agent_v1.2.2.so' };
    }
    if (compareVersions(uitestVersion, AGENT_VERSION_1_1_10_BASE) >= 0) {
        return { architecture, transport: 'tcp', version: '1.1.10', fileName: 'uitest_agent_v1.1.10.so' };
    }
    if (compareVersions(uitestVersion, AGENT_VERSION_1_1_5_BASE) >= 0) {
        return { architecture, transport: 'tcp', version: '1.1.5', fileName: 'uitest_agent_v1.1.5.so' };
    }
    return { architecture, transport: 'tcp', version: '1.1.3', fileName: 'uitest_agent_v1.1.3.so' };
}

export function parseInstalledAgentVersion(marker: string): string | undefined {
    const newMarkerVersion = marker.match(/#v?(\d+(?:\.\d+){2,3})/);
    if (newMarkerVersion) {
        return newMarkerVersion[1];
    }
    const oldMarkerVersion = marker.match(/UITEST_AGENT_LIBRARY@v?(\d+(?:\.\d+){2,3})/);
    return oldMarkerVersion?.[1];
}

export function agentVersionNeedsUpdate(installedVersion: string | undefined, requiredVersion: string): boolean {
    if (!installedVersion) {
        return true;
    }
    const installedParts = numericVersion(installedVersion, 'installed agent');
    const requiredParts = numericVersion(requiredVersion, 'required agent');
    return installedParts[0] !== requiredParts[0] || installedParts[1] !== requiredParts[1] ||
        compareVersions(installedVersion, requiredVersion) < 0;
}
