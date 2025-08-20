import { getLogger } from 'log4js';
import { UIEvent } from '../event/ui_event';
import { imageHash } from 'image-hash';

const logger = getLogger();

const DEFAULT_THRESHOLD = 0.75;
const REUSE_THRESHOLD = 0.99;

class Tarpit {
    constructor(
        public readonly id: number,
        public readonly tarpitScreenPath: string,
        public visitedTimes: number = 0,
        public actions: any[] = [], // Actions taken in this tarpit
        public readonly name: string = `tarpit_${id}`
    ) {}

    getTarpitName(): string {
        return this.name;
    }

    getVisitedTimes(): number {
        return this.visitedTimes;
    }

    addVisitedTimes(): void {
        this.visitedTimes++;
    }

    getTarpitScreen(): string {
        return this.tarpitScreenPath;
    }

    getTarpitActions(): any[] {
        return this.actions;
    }

    clearTarpitActions(): void {
        this.actions = [];
    }
}

export class UITarpitDetector {
    private simK: number;
    private simCount: number = 0;
    private tarpitList: Tarpit[] = [];
    private targetTarpit: Tarpit | null = null;

    constructor(simK: number) {
        this.simK = simK;
    }

    getSimCount(): number {
        return this.simCount;
    }

    resetSimCount(): void {
        this.simCount = 0;
        logger.debug(`simCount reset to 0`);
    }

    setTargetTarpit(tarpit: Tarpit): void {
        this.targetTarpit = tarpit;
    }

    getTargetTarpit(): Tarpit | null {
        return this.targetTarpit;
    }

    async isSimilarPage(lastPage?: string, currentPage?: string): Promise<boolean> {
        const simScore = await this.calculateSimilarity(lastPage!, currentPage!);
        logger.info(`similarity score: ${simScore}`);
        return simScore >= DEFAULT_THRESHOLD;
    }

    async detectedUITarpit(lastPage?: string, currentPage?: string): Promise<boolean> {
        const isSimilar = await this.isSimilarPage(lastPage, currentPage);
        if (!isSimilar) {
            this.simCount = 0;
        } else {
            this.simCount++;
        }
        logger.info(`simCount: ${this.simCount}`);
        return this.simCount >= this.simK;
    }

    stuckInTarpit(): boolean {
        return this.simCount > this.simK;
    }

    printUiTarpits(): void {
        Object.entries(this.tarpitList).forEach(([tarpitName, tarpitInfo]) => {
            console.log(`tarpit name: ${tarpitName}, info: ${JSON.stringify(tarpitInfo)}`);
        });
        console.log(`total tarpits: ${Object.keys(this.tarpitList).length}`);
    }

    async isNewTarpit(screenshot: string): Promise<boolean> {
        for (const tarpit of this.tarpitList) {
            const simScore = await this.calculateSimilarity(screenshot, tarpit.getTarpitScreen());
            if (simScore >= REUSE_THRESHOLD) {
                console.log(`Visiting known tarpit: ${tarpit.getTarpitName()}`);
                tarpit.addVisitedTimes();
                this.targetTarpit = tarpit;
                return false;
            }
        }
        return true;
    }

    async addNewTarpit(screenshotPath: string): Promise<void> {
        this.targetTarpit = new Tarpit(this.tarpitList.length, screenshotPath);

        this.targetTarpit.addVisitedTimes();
        this.tarpitList.push(this.targetTarpit);
        logger.log(`New UI tarpit saved: ${this.targetTarpit.getTarpitName()}`);
    }

    updateTarpitActions(event: UIEvent): void {
        this.targetTarpit?.actions.push(event);
        logger.info(`UI tarpit updated: ${this.targetTarpit}, add event: ${event.getEventType()}`);
    }

    // Calculate the dhash of an image
    dhash(imagePath: string, hashSize: number = 8): Promise<string> {
        return new Promise((resolve, reject) => {
            imageHash(imagePath, hashSize, 'dhash', (error: Error | null, data: string) => {
                if (error) reject(error);
                else resolve(data);
            });
        });
    }

    // Calculate the Hamming distance between two hash strings (character level)
    private hammingDistance(hash1: string, hash2: string): number {
        let dist = 0;
        const len = Math.min(hash1.length, hash2.length);
        for (let i = 0; i < len; i++) {
            if (hash1[i] !== hash2[i]) dist++;
        }
        dist += Math.abs(hash1.length - hash2.length);
        return dist;
    }

    // Calculate the similarity between two images, range 0~1
    async calculateSimilarity(fileA: string, fileB: string): Promise<number> {
        try {
            const hashA = await this.dhash(fileA);
            const hashB = await this.dhash(fileB);
            const dist = this.hammingDistance(hashA, hashB);
            const maxLen = Math.max(hashA.length, hashB.length);
            return 1 - dist / maxLen;
        } catch (error) {
            console.error('Error calculating similarity:', error);
            return 0;
        }
    }
}
