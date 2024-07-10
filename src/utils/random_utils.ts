export class RandomUtils {
    /**
     * Generate random integer.
     * @param min
     * @param max
     * @returns
     */
    static genRandomNum(min: number, max: number): number {
        let range = max - min;
        let rand = Math.random();
        return min + Math.round(rand * range);
    }

    static shuffle<T>(a: Array<T>): Array<T> {
        a.sort(() => Math.random() - 0.5);
        return a;
    }
}
