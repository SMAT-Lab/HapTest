export class Hap {
    private _bundleName: string;
    private _versionCode: number;
    private _mainAbility: string;
    private _ablities: string[];
    private _hapFile: string;

    constructor() {
        this._ablities = [];
    }

    public get bundleName(): string {
        return this._bundleName;
    }

    public set bundleName(bundleName: string) {
        this._bundleName = bundleName;
    }

    public get versionCode(): number {
        return this._versionCode;
    }

    public set versionCode(versionCode: number) {
        this._versionCode = versionCode;
    }

    public get mainAbility(): string {
        return this._mainAbility;
    }

    public set mainAbility(mainAbility: string) {
        this._mainAbility = mainAbility;
    }

    public get ablities(): string[] {
        return this._ablities;
    }

    public set ablities(ablities: string[]) {
        this._ablities = ablities;
    }

    public get hapFile(): string {
        return this._hapFile;
    }

    public set hapFile(hapFile: string) {
        this._hapFile = hapFile;
    }
}
