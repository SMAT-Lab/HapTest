# 开发环境准备

### 1. VSCode 插件安装与配置
#### 1.1 格式插件 Prettier - Code formatter
1. 打开VSCode插件市场，搜索Prettier，找到"Prettier - Code formatter"后安装  
2. 打开任意ts文件，点击右键“Format Document With...”根据弹框把"Prettier - Code formatter"设为默认

#### 1.2 LaTex 插件Markdown Preview Enhanced
1. 打开VSCode插件市场，搜索Markdown，找到"Markdown Preview Enhanced"后安装  
2. 按组合键"Ctrl + Shit + P" 搜Markdown Preview Enhanced全局配置，粘贴以下代码
```
({
  // Please visit the URL below for more information:
  // https://shd101wyy.github.io/markdown-preview-enhanced/#/extend-parser

  onWillParseMarkdown: async function (markdown) {
    return markdown;
  },

  onDidParseMarkdown: async function (html) {
    return `
      <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.7/katex.min.js"
              integrity="sha512-EKW5YvKU3hpyyOcN6jQnAxO/L8gts+YdYV6Yymtl8pk9YlYFtqJgihORuRoBXK8/cOIlappdU6Ms8KdK6yBCgA=="
              crossorigin="anonymous" referrerpolicy="no-referrer">
      </script>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pseudocode@latest/build/pseudocode.min.css">
      <script src="https://cdn.jsdelivr.net/npm/pseudocode@latest/build/pseudocode.min.js">
      </script>
      ${html}
      <script>
          pseudocode.renderClass("pseudocode");
      </script>`;
  },
});
```
3. 打开doc\ptg_search_algorithm.md 开启Markdown Preview，选择右键"Open In Browser"在浏览器中可预览LaTex
