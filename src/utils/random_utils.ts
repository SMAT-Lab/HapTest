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

    /**
     * Generate random string
     * @param len string length
     * @returns 
     */
    static genRandomString(len: number): string {
        const chars = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890';
        const randomArray = Array.from({ length: len }, (v, k) => chars[Math.floor(Math.random() * chars.length)]);
        return randomArray.join('');
    }
}
