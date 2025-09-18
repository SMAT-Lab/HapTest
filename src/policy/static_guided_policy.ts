import path from "path";
import { Device } from "../device/device";
import { Event } from "../event/event";
import { Hap } from "../model/hap";
import { PolicyName } from "./policy";
import { MAX_NUM_RESTARTS, PTGPolicy } from "./ptg_policy";
import { exec } from "child_process";
import * as fs from "fs";
import { EventBuilder } from "../event/event_builder";
import { RandomUtils } from "../utils/random_utils";
import { Component } from "../model/component";
import { ExitEvent } from "../event/system_event";
import { WaitEvent } from "../event/wait_event";

export class StaticGuidedPolicy extends PTGPolicy {
    private pageComponentMap: Map<string, Component[]>;
    private dumpDir: string = "../../static/test-demo/layout/";
    private outputDir: string = "../../static/test-demo/out/";
    private analyzerPath: string; 
    private originalCwd: string;
    private targetDir: string;
    private config: string;

    constructor(device: Device, hap: Hap, name: PolicyName, config: string) {
        super(device, hap, name, true);
        this.pageComponentMap = new Map();
        this.analyzerPath = path.resolve(__dirname, "../../static/test-demo/arkuianalyzer.js");
        // 保存当前工作目录
        this.originalCwd = process.cwd();
        console.info(`原始工作目录: ${this.originalCwd}`);
        this.targetDir = path.dirname(this.analyzerPath);
        this.config = config;
    }

    // 给类添加一个缓冲区来保存异步获取的事件
    private pendingEvent: Event | null = null;
    private eventFetching: boolean = false;
    

    generateEventBasedOnPtg(): Event {
        this.updateState();
        const fileName = `layout_${Date.now()}.json`; // 使用时间戳生成唯一文件名
        const filePath = path.resolve(__dirname, this.dumpDir, fileName);
        

        // 如果已经异步拿到一个事件了，就直接返回它
        if (this.pendingEvent) {
            const event = this.pendingEvent;
            this.pendingEvent = null;
            this.eventFetching = false; // 重置状态，允许下一次异步获取
            return event;
        }

        if(!this.eventFetching){
            this.logger.info("开始异步调用 dumpLayout 并保存布局文件...");
            // 启动异步逻辑（只启动一次）
            this.eventFetching = true;

            // 获取当前页面布局并保存到文件
            this.dumpLayout()
            .then(layout => {
                try {
                    fs.writeFileSync(filePath, layout, "utf-8");
                    this.logger.info(`页面布局已成功保存到文件: ${filePath}`);
                } catch (error) {
                    this.logger.error(`保存页面布局到文件失败: ${error}`);
                    throw new Error("保存页面布局到文件失败。");
                }

                // 将 exec 包装为 Promise
                return new Promise((resolve, reject) => {
                    // 切换到目标目录
                    process.chdir(this.targetDir);
                    this.logger.info(`切换到目录: ${this.targetDir}`);
                    // 运行 arkuianalyzer.js 脚本

                    exec(`node arkuianalyzer.js ${this.config}`, (error: any, stdout: string, stderr: string) => {
                        if (error) {
                            this.logger.error(`运行 arkuianalyzer.js 时出错: ${error.message}`);
                            reject(error);
                            return;
                        }
                        if (stderr) {
                            this.logger.warn(`arkuianalyzer.js 警告: ${stderr}`);
                        }
                        this.logger.info(`arkuianalyzer.js 输出: ${stdout}`);
        
                        // 确保在 node 命令执行完成后再调用 generateEventBasedOnStaticJsonFile
                        const event = this.generateEventBasedOnStaticJsonFile(fileName);
                        if (event === undefined) {
                            if (this.retryCount > MAX_NUM_RESTARTS) {
                                this.stop();
                                this.pendingEvent = new ExitEvent();
                            } else {
                                this.retryCount++;
                                this.pendingEvent = EventBuilder.createRandomTouchEvent(this.device);
                            }
                        } else {
                            this.retryCount = 0;
                            this.pendingEvent = event;
                            this.logger.info("generateEventBasedOnStaticJsonFile 成功返回");
                        }
    
                        resolve(stdout);
                    });
                });
            })
            .catch(err => {
                this.logger.error(`dumpLayout failed: ${err}`);
                this.logger.info("生成一个随机事件");
                this.pendingEvent = EventBuilder.createRandomTouchEvent(this.device);
            })
            .finally(() => {
                this.logger.info("dumpLayout finally");
                fs.unlinkSync(filePath); // 删除布局文件
                this.logger.info(`已删除布局文件: ${filePath}`);
                // 恢复原始工作目录
                process.chdir(this.originalCwd);
                this.logger.info(`恢复到原始目录: ${this.originalCwd}`);
            });
        }

        return new WaitEvent(); // 返回一个等待事件，等待布局文件生成和分析完成
    }

    async dumpLayout(): Promise<string> {
        let layout = await this.device.getDriver().dumpLayout();
        return JSON.stringify(layout, null, 4); // 转换为 JSON 字符串
    }

    private generateEventBasedOnStaticJsonFile(jsonfile:string): Event|undefined {
        let events: Event[] = []; // 用于存储所有 event 的内容
        try {
            const file = jsonfile.replace(".json","_guided.json"); // 指定一个具体的文件名        
            this.logger.info(`尝试读取 JSON 文件: ${file}`);
            const filePath = path.resolve(__dirname, this.outputDir, file);
            const content = fs.readFileSync(filePath, "utf-8");
            // this.logger.info(`读取到的 JSON 文件内容 (${filePath}): ${content}`);
            this.logger.info("尝试读取并解析 JSON 文件以生成事件...");

            // 解析 JSON 文件内容
            const jsonData = JSON.parse(content);

            for (const edge of jsonData.edges) { 
                for (const node of edge.nodes) {
                    this.logger.info(`解析node: ${JSON.stringify(node)}`);
                    const event = EventBuilder.createEventFromNode(node);
                    if(event){
                        events.push(event);
                    }else{
                        this.logger.warn(`从节点生成事件时返回了 undefined，跳过该节点: ${JSON.stringify(node)}`);
                    }
                }      
            }

            // 删除读取的文件
            fs.unlinkSync(filePath);
            this.logger.info(`已删除临时文件: ${filePath}`);
        
        if(events.length == 1){
            this.logger.info(`仅生成了一个事件，直接返回该事件: ${JSON.stringify(events[0])}`);
            return events[0];
        }else{
            this.logger.info(`生成了多个事件，共 ${events.length} 个。`);
            // 随机选择一个事件返回
            const randomEvent = events[RandomUtils.genRandomNum(0, events.length - 1)];
            this.logger.info(`随机选择的事件: ${JSON.stringify(randomEvent)}`);
            return randomEvent;
        }

        } catch (error) {
            this.logger.error(`读取或删除 JSON 文件时出错: ${error}`);
        }

        return undefined;
    }
    
    private updateState(): void {
            if (!this.currentPage!.isForeground()) {
                return;
            }
    
            let pageSig = this.currentPage!.getContentSig();
            if (!this.pageComponentMap.has(pageSig)) {
                let components: Component[] = [];
                for (const component of this.currentPage!.getComponents()) {
                    if (component.hasUIEvent()) {
                        components.push(component);
                    }
                }
                this.pageComponentMap.set(pageSig, components);
            }
        }
}