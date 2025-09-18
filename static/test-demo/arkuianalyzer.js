// 1. 导入 bundle.js（关键：所有需要的模块都从 bundle 中获取，无需再写 ../../src 路径）
const {
  ModelUtils,
  Scene,
  SceneConfig,
  ArkUIViewTree,
  UIFuncGraph,
  tabBar_2_TabContent,
  GlobalOverlayTree,
  UIFuncGraphBuilder,
  ArkUIViewTreePrinter,
} = require('./bundle.js'); // 路径需对应你的 bundle.js 实际位置（如在根目录就写 './bundle.js'）

// 2. 导入 Node.js 内置的 fs 模块（之前已在 Rollup 中配置 external: ['fs']，直接 require 即可）
const fs = require('fs');
const path = require('path');

// 3. 定义测试类（逻辑与你的原代码完全一致）
class ViewTreeTest {
  constructor(configPath) {
    this.configPath = configPath; // 从构造函数接收配置路径
  }

  // 初始化项目（原逻辑不变）
  InitProject() {
    //const configPath = path.resolve(__dirname, "./config/project_config.json");
    // 转为绝对路径（避免相对路径混乱）
    const finalConfigPath = path.resolve(this.configPath);
    // 检查文件是否存在
    if (!fs.existsSync(finalConfigPath)) {
      console.error(`[错误] 配置文件不存在：${finalConfigPath}`);
      process.exit(1);
    }
    console.log(`使用配置文件: ${finalConfigPath}`);
    const sceneConfig = new SceneConfig();
    sceneConfig.buildFromJson(finalConfigPath);

    const scene = new Scene();
    scene.buildBasicInfo(sceneConfig);
    scene.buildScene4HarmonyProject();

    scene.inferTypes();

    console.log("=== Scene Build Complete ===");
    for (const arkfile of scene.getFiles()) {
      console.log("File:", arkfile.getName());
    }

    let uifuncgraph = new UIFuncGraph(scene);
    let uiFuncGraphBuilder = new UIFuncGraphBuilder(uifuncgraph, scene);

    // 打印 ViewTree
    if (1) {
      this.printViewTree(scene);
    }

    // 构建 UI 函数图
    if (1) {
      uiFuncGraphBuilder.InitNode();
      uiFuncGraphBuilder.FindApiFromViewTreeUseCallGraph();
      // uiFuncGraphBuilder.FindApiFromViewTree();
      // uifuncgraph.removeNonUiabilityAndNonPageNodes();
    }

    // 匹配动态组件树并生成 dot 文件
    const dynamic_trees = uifuncgraph.MatchStaticAndDynamicComponentTrees(uifuncgraph);
    console.log("dynmaic tree size = ", dynamic_trees.length);
    for (let i = 0; i < dynamic_trees.length; i++) {
      let dynamic_tree = dynamic_trees[i];
      let dotFileName = `viewtree/componentTree_dynamic.dot`;
      let treePrinter = new ArkUIViewTreePrinter(dynamic_tree);
      let dotContent = treePrinter.dump();
      fs.writeFileSync(dotFileName, dotContent, 'utf8');
    }

    console.log("tabbar size = ", tabBar_2_TabContent.size);
    uifuncgraph.dump(path.resolve(__dirname, "./out/cg.dot"));
  }

  // 打印 ViewTree（原逻辑不变）
  printViewTree(scene) {
    const outputDir = "viewtree";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir); // 创建输出文件夹
    }

    // 遍历场景中的文件和类，生成组件树 dot 文件
    for (const arkFile of scene.getFiles()) {
      for (const arkclass of ModelUtils.getAllClassesInFile(arkFile)) {
        let viewTree = arkclass.getArkUIViewTree();
        let class_name = arkclass.getName();

        if (viewTree) {
          // 处理文件名中的斜杠（避免路径错误）
          let sanitizedFileName = arkFile.getName().replace(/\//g, '_');
          let dotFileName = `viewtree/componentTree_${sanitizedFileName}_${class_name}.dot`;
          let treePrinter = new ArkUIViewTreePrinter(viewTree);
          let dotContent = treePrinter.dump();
          fs.writeFileSync(dotFileName, dotContent, 'utf8');
          console.log(`Component tree for ${class_name} has been written to ${dotFileName}`);
        }
      }
    }

    // 处理全局 Overlay 树
    if (GlobalOverlayTree.length > 0) {
      console.log("GlobalOverlayTree size = ", GlobalOverlayTree.length);
      console.log("==== Global Overlay Tree ====");
      GlobalOverlayTree.forEach((overlayNode, idx) => {
        let dotFileName = `viewtree/ArkUI_overlayTree_${idx}.dot`;
        // 构建临时 ArkUIViewTree 实例（原逻辑不变）
        let fakeTree = {
          getRoot: () => overlayNode,
          isClassField: () => false,
          getClassFieldType: () => undefined,
          getStateValues: () => new Map()
        };
        let treePrinter = new ArkUIViewTreePrinter(fakeTree);
        let dotContent = treePrinter.dump();
        fs.writeFileSync(dotFileName, dotContent, 'utf8');
        console.log(`Overlay tree #${idx} has been written to ${dotFileName}`);
      });
    } else {
      console.log("No overlay nodes found in GlobalOverlayTree.");
    }
  }
}

// 4. 执行测试（实例化并调用 InitProject）
const args = process.argv.slice(2); // 获取命令行参数（排除前两个默认参数）

if (args.length === 0) {
  console.error("请指定配置文件路径！用法：node viewTreeTest.js <configPath>");
  process.exit(1);
}
const configPath = path.resolve(args[0]);
const test = new ViewTreeTest(configPath);
test.InitProject();