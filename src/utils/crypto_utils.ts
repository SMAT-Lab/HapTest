import * as crypto from 'crypto';

export class CryptoUtils {
    static sha256(content: string): string {
        let sha256 = crypto.createHash('sha256');
        sha256.update(content);
        return sha256.digest('hex');
    }
}
