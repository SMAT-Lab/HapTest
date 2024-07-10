import { KeyCode } from '../model/key_code';
import { Point } from '../model/point';

export enum Direct {
    LEFT = 0,
    RIGHT = 1,
    UP = 2,
    DOWN = 3,
}

export interface EventSimulator {
    /**
     * Simulate a single click
     * @param point
     */
    click(point: Point): void;

    /**
     * Simulate a double-click operation
     * @param point
     */
    doubleClick(point: Point): void;

    /**
     * Simulate a long press
     * @param point
     */
    longClick(point: Point): void;

    /**
     * Simulate the input text operation in the input box
     * @param point
     * @param text
     */
    inputText(point: Point, text: string): void;

    /**
     * Simulate a fast-swipe operation
     * @param from
     * @param to
     * @param velocity value range [200-40000]
     * @param step swipe step size
     */
    fling(from: Point, to: Point, velocity: number, step: number): void;

    /**
     * Simulate a fast-direct-swipe operation
     * @param direct
     * @param velocity value range [200-40000]
     * @param step
     */
    directFling(direct: Direct, velocity: number, step: number): void;
    /**
     * Simulate a slow swipe operation
     * @param from
     * @param to
     * @param velocity value range [200-40000]
     */
    swipe(from: Point, to: Point, velocity: number): void;

    /**
     * Simulate drag-and-drop operation
     * @param from
     * @param to
     * @param velocity value range [200-40000]
     */
    drag(from: Point, to: Point, velocity: number): void;

    /**
     * Simulate key input operation
     * @param key0
     * @param key1
     * @param key2
     */
    inputKey(key0: KeyCode, key1: KeyCode | undefined, key2: KeyCode | undefined): void;

    /**
     * Start ablity to run Hap
     * @param bundleName
     * @param abilityName
     * @returns
     */
    startAblity(bundleName: string, abilityName: string): boolean;

    /**
     * Force stop HAP
     * @param bundleName
     */
    forceStop(bundleName: string): void;

    /**
     * Get the width of the screen
     * @returns
     */
    getWidth(): number;

    /**
     * Get the height of the screen
     * @returns
     */
    getHeight(): number;
}
