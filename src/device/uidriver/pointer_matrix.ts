import { Point } from '../../model/point';
import { FrontEnd, RpcApiCall } from './front_end';
import { HypiumRpc } from './hypium_rpc';

export class PointerMatrix extends FrontEnd {
    constructor(rpc: HypiumRpc) {
        super(rpc);
    }

    /**
     *
     * @param fingers
     * @param steps
     */
    @RpcApiCall()
    async create(fingers: number, steps: number) {}

    @RpcApiCall()
    async free() {}

    @RpcApiCall()
    async setPoint(finger: number, step: number, point: Point) {}

    async setPointInterval(finger: number, step: number, point: Point, interval: number) {
        await this.setPoint(finger, step, { x: point.x + 65536 * interval, y: point.y });
    }
}
