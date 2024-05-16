import fs from 'fs';
import path from 'path';
import { coloredInfo, coloredError, coloredWarn, coloredDebug } from "../utils/logger";
import sleep from '../utils/sleepTimout';
export class SnipeListCache {
  private snipeList: Set<string> = new Set<string>(); // 明确指定 Set 里的元素类型为 string

  private fileLocation = path.join(__dirname, '../../snipe-list.txt');

  constructor() {
    this.loadSnipeList()
  }

  public async init() {
    while (true) {
      this.loadSnipeList()
      await sleep(2500);
    }
  }

  public isInList(mint: string) {
    return this.snipeList.has(mint);
  }

  public getSnipeList(){
    return Array.from(this.snipeList); // 将 Set 转换为数组
  }

  private loadSnipeList() {
    coloredInfo(`Refreshing snipe list...`);

    const count = this.snipeList.size;
    const data = fs.readFileSync(this.fileLocation, 'utf-8');
    const lines = data
      .split('\n')
      .map((line) => line.trim()) // 去除每行首尾空白字符
      .filter((line) => line.length > 0); // 过滤掉空行

    // 使用 Set 的构造函数时明确指定类型为 string
    this.snipeList = new Set<string>(lines);

    if (this.snipeList.size !== count) {
      coloredInfo(`Loaded snipe list: ${this.snipeList.size}`);

    }
  }
}