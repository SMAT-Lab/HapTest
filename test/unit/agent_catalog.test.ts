import { describe, expect, it } from 'vitest';
import {
    agentVersionNeedsUpdate,
    detectAgentArchitecture,
    inspectAgentCompatibility,
    parseInstalledAgentVersion,
    selectAgentProfile,
} from '../../src/device/uidriver/agent_catalog';

describe('uitest agent catalog', () => {
    it('selects ARM64 agents at the xdevice-ohos version boundaries', () => {
        expect(selectAgentProfile('5.1.1.1', 'arm64')).toMatchObject({ version: '1.1.3', transport: 'tcp' });
        expect(selectAgentProfile('5.1.1.2', 'arm64')).toMatchObject({ version: '1.1.3', transport: 'tcp' });
        expect(selectAgentProfile('5.1.1.3', 'arm64')).toMatchObject({ version: '1.1.10', transport: 'tcp' });
        expect(selectAgentProfile('6.0.2.1', 'arm64')).toMatchObject({ version: '1.1.10', transport: 'tcp' });
        expect(selectAgentProfile('6.0.2.2', 'arm64')).toMatchObject({ version: '1.2.2', transport: 'unix' });
    });

    it('selects the x86_64 agent independently of uitest version', () => {
        expect(selectAgentProfile('6.0.2.3', 'x86_64')).toMatchObject({
            version: '1.1.9', transport: 'tcp', fileName: 'uitest_agent_v1.1.9.x86_64_so',
        });
    });

    it('detects supported ELF architecture spellings and rejects unknown ones', () => {
        expect(detectAgentArchitecture('ELF 64-bit LSB shared object, ARM aarch64')).toBe('arm64');
        expect(detectAgentArchitecture('ELF 64-bit LSB shared object, x86-64')).toBe('x86_64');
        expect(() => detectAgentArchitecture('ELF 64-bit LSB shared object, RISC-V')).toThrow(/Unsupported/);
    });

    it('reads both legacy and current agent markers', () => {
        expect(parseInstalledAgentVersion('UITEST_AGENT_LIBRARY@v1.1.10')).toBe('1.1.10');
        expect(parseInstalledAgentVersion('UITEST_AGENT_LIBRARY@v0.0.0#1.2.2')).toBe('1.2.2');
        expect(parseInstalledAgentVersion('unrecognized')).toBeUndefined();
    });

    it('keeps compatible installed versions and replaces old, wrong-architecture, or unknown agents', () => {
        const armProfile = selectAgentProfile('6.0.2.3', 'arm64');
        expect(inspectAgentCompatibility(armProfile, 'UITEST_AGENT_LIBRARY@v0.0.0#1.2.2', 'ELF 64-bit LSB shared object, ARM aarch64'))
            .toEqual({ version: '1.2.2', reasons: [] });
        expect(inspectAgentCompatibility(armProfile, 'UITEST_AGENT_LIBRARY@v1.0.8', 'ELF 64-bit LSB shared object, ARM aarch64').reasons)
            .toContain('agent version 1.0.8 does not meet required version 1.2.2');
        expect(inspectAgentCompatibility(armProfile, 'UITEST_AGENT_LIBRARY@v0.0.0#1.2.2', 'ELF 64-bit LSB shared object, x86-64').reasons)
            .toContain('ELF architecture does not match required architecture arm64');
        expect(inspectAgentCompatibility(armProfile, '', 'ELF 64-bit LSB shared object, ARM aarch64').reasons)
            .toContain('agent version marker is missing or unrecognized');
        expect(agentVersionNeedsUpdate('1.2.3', '1.2.2')).toBe(false);
        expect(agentVersionNeedsUpdate('2.0.0', '1.2.2')).toBe(true);
    });
});
