import { ClassTransformOptions, instanceToPlain } from 'class-transformer';

export class SerializeUtils {
    static instanceToPlain<T>(object: T, options?: ClassTransformOptions): Record<string, any> {
        let defaultOptions: ClassTransformOptions = { enableCircularCheck: true, excludeExtraneousValues: true };
        defaultOptions.groups = options?.groups;
        return instanceToPlain(object, defaultOptions);
    }

    static serialize<T>(object: T, options?: ClassTransformOptions, space?: number): string {
        return JSON.stringify(SerializeUtils.instanceToPlain(object, options), null, space);
    }
}
