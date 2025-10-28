import { saveToLocalStorage, getFromLocalStorage, copyToClipboard } from './utils.js';
import { getVersion, connectDevice, fetchScreenshot, fetchHierarchy, fetchXpathLite } from './api.js';

new Vue({
  el: '#app',
  data() {
    return {
      version: '',
      deviceAlias: '',
      isConnected: false,
      isConnecting: false,
      isDumping: false,

      packageName: '',
      activityName: '',
      pagePath: '',
      updatedAt: '',
      displaySize: [0, 0],
      scale: 1,

      screenshotTransform: { scale: 1, offsetX: 0, offsetY: 0 },
      jsonHierarchy: null,
      treeData: [],
      hoveredNode: null,
      selectedNode: null,
      nodeIndex: Object.create(null),
      xpathLite: '//',
      mouseClickCoordinatesPercent: null,

      nodeFilterText: '',
      defaultTreeProps: {
        children: 'children',
        label(data) {
          if (!data) {
            return '';
          }
          const suffix = data.text || data.id || data.name || '';
          return data._type ? `${data._type}${suffix ? ' - ' + suffix : ''}` : suffix;
        },
      },
      centerWidth: 480,
      isDividerHovered: false,
      isDragging: false,
    };
  },
  computed: {
    selectedNodeDetails() {
      const defaults = this.getDefaultNodeDetails();
      if (!this.selectedNode) {
        return defaults;
      }

      const node = this.selectedNode;
      const details = [];

      const append = (key, value) => {
        if (value === undefined || value === null || value === '') {
          return;
        }
        details.push({ key, value });
      };

      append('componentPath', node.componentPath);
      append('xpathLite', node.xpath || this.xpathLite);
      append('type', node._type);
      append('id', node.id);
      append('name', node.name);
      append('text', node.text);
      append('hint', node.hint);
      append('rect', `(${node.rect.x}, ${node.rect.y}, ${node.rect.width}, ${node.rect.height})`);
      append('clickable', node.clickable);
      append('enabled', node.enabled);
      append('focusable', node.focusable);
      append('focused', node.focused);
      append('scrollable', node.scrollable);
      append('longClickable', node.longClickable);
      append('selected', node.selected);
      append('debugLine', node.debugLine);

      return [...defaults, ...details];
    }
  },
  watch: {
    nodeFilterText(val) {
      if (this.$refs.treeRef) {
        this.$refs.treeRef.filter(val);
      }
    }
  },
  created() {
    this.fetchVersion();
  },
  mounted() {
    this.loadCachedScreenshot();
    const canvas = this.$el.querySelector('#hierarchyCanvas');
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onMouseClick);
    canvas.addEventListener('mouseleave', this.onMouseLeave);

    this.setupCanvasResolution('#screenshotCanvas');
    this.setupCanvasResolution('#hierarchyCanvas');
  },
  methods: {
    async fetchVersion() {
      try {
        const response = await getVersion();
        this.version = response.data;
      } catch (err) {
        console.error(err);
      }
    },
    async connectDevice() {
      if (this.isConnecting) {
        return;
      }
      this.isConnecting = true;
      try {
        const response = await connectDevice();
        if (response.success) {
          this.isConnected = true;
          this.deviceAlias = response.data?.alias || 'local-device';
          this.$message({ showClose: true, message: 'Device connected', type: 'success' });
        } else {
          throw new Error(response.message || 'Connect failed');
        }
      } catch (err) {
        this.$message({ showClose: true, message: `Error: ${err.message}`, type: 'error' });
      } finally {
        this.isConnecting = false;
      }
    },
    async screenshotAndDumpHierarchy() {
      if (!this.isConnected) {
        this.$message({ showClose: true, message: 'Please connect a device first', type: 'warning' });
        return;
      }
      this.isDumping = true;
      try {
        await this.fetchScreenshot();
        await this.fetchHierarchy();
      } catch (err) {
        this.$message({ showClose: true, message: `Error: ${err.message}`, type: 'error' });
      } finally {
        this.isDumping = false;
      }
    },
    async fetchScreenshot() {
      try {
        const response = await fetchScreenshot();
        if (response.success) {
          const base64Data = response.data;
          this.renderScreenshot(base64Data);
          saveToLocalStorage('cachedScreenshot', base64Data);
        } else {
          throw new Error(response.message || 'Fetch screenshot failed');
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    async fetchHierarchy() {
      try {
        const response = await fetchHierarchy();
        if (response.success) {
          const ret = response.data;
          this.packageName = ret.packageName || this.packageName || '';
          this.activityName = ret.activityName || '';
          this.pagePath = ret.pagePath || '';
          this.updatedAt = ret.updatedAt || new Date().toISOString();
          this.displaySize = ret.windowSize || [0, 0];
          this.scale = ret.scale || 1;
          this.jsonHierarchy = ret.jsonHierarchy;
          this.treeData = this.jsonHierarchy ? [this.jsonHierarchy] : [];

          this.hoveredNode = null;
          this.selectedNode = null;
          this.nodeIndex = this.createNodeIndex(this.jsonHierarchy);
          if (this.$refs.treeRef && this.$refs.treeRef.setCurrentKey) {
            this.$refs.treeRef.setCurrentKey(null);
          }
          this.xpathLite = '//';

          this.renderHierarchy();
        } else {
          throw new Error(response.message || 'Fetch hierarchy failed');
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    getDefaultNodeDetails() {
      return [
        { key: 'device', value: this.deviceAlias || '-' },
        { key: 'bundleName', value: this.packageName || '-' },
        { key: 'abilityName', value: this.activityName || '-' },
        { key: 'pagePath', value: this.pagePath || '-' },
        { key: 'updatedAt', value: this.updatedAt || '-' },
        { key: 'displaySize', value: `(${this.displaySize[0]}, ${this.displaySize[1]})` },
      ];
    },
    createNodeIndex(root) {
      const index = Object.create(null);
      const traverse = (node) => {
        if (!node || !node._id) {
          return;
        }
        index[node._id] = node;
        if (Array.isArray(node.children)) {
          node.children.forEach(traverse);
        }
      };
      if (root) {
        traverse(root);
      }
      return index;
    },
    loadCachedScreenshot() {
      const cachedScreenshot = getFromLocalStorage('cachedScreenshot', null);
      if (cachedScreenshot) {
        this.renderScreenshot(cachedScreenshot);
      }
    },
    renderScreenshot(base64Data) {
      const img = new Image();
      img.src = `data:image/png;base64,${base64Data}`;
      img.onload = () => {
        const canvas = this.$el.querySelector('#screenshotCanvas');
        const ctx = canvas.getContext('2d');

        const { clientWidth: canvasWidth, clientHeight: canvasHeight } = canvas;

        this.setupCanvasResolution('#screenshotCanvas');

        const { width: imgWidth, height: imgHeight } = img;
        const scale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight);
        const x = (canvasWidth - imgWidth * scale) / 2;
        const y = (canvasHeight - imgHeight * scale) / 2;

        this.screenshotTransform = { scale, offsetX: x, offsetY: y };

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, x, y, imgWidth * scale, imgHeight * scale);

        this.setupCanvasResolution('#hierarchyCanvas');
        this.renderHierarchy();
      };
    },
    renderHierarchy() {
      const canvas = this.$el.querySelector('#hierarchyCanvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!this.jsonHierarchy) {
        return;
      }

      const { scale, offsetX, offsetY } = this.screenshotTransform;

      const drawNode = (node) => {
        if (node.rect) {
          const { x, y, width, height } = node.rect;
          const scaledX = x * scale + offsetX;
          const scaledY = y * scale + offsetY;
          const scaledWidth = width * scale;
          const scaledHeight = height * scale;

          ctx.save();

          if (this.selectedNode && node._id === this.selectedNode._id) {
            ctx.setLineDash([]);
            ctx.strokeStyle = '#409EFF';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(64, 158, 255, 0.18)';
            ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
          } else if (this.hoveredNode && node._id === this.hoveredNode._id) {
            ctx.setLineDash([]);
            ctx.strokeStyle = '#67C23A';
            ctx.lineWidth = 1.5;
            ctx.fillStyle = 'rgba(103, 194, 58, 0.18)';
            ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
          } else {
            ctx.setLineDash([2, 6]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 0.7;
          }

          ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
          ctx.restore();
        }

        if (node.children) {
          node.children.forEach(drawNode);
        }
      };

      drawNode(this.jsonHierarchy);
    },
    setupCanvasResolution(selector) {
      const canvas = this.$el.querySelector(selector);
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    },
    findSmallestNode(node, mouseX, mouseY, scale, offsetX, offsetY) {
      let smallestNode = null;

      const checkNode = (current) => {
        if (current.rect) {
          const { x, y, width, height } = current.rect;
          const scaledX = x * scale + offsetX;
          const scaledY = y * scale + offsetY;
          const scaledWidth = width * scale;
          const scaledHeight = height * scale;

          if (
            mouseX >= scaledX &&
            mouseY >= scaledY &&
            mouseX <= scaledX + scaledWidth &&
            mouseY <= scaledY + scaledHeight
          ) {
            if (!smallestNode || width * height < smallestNode.rect.width * smallestNode.rect.height) {
              smallestNode = current;
            }
          }
        }

        if (current.children) {
          current.children.forEach(checkNode);
        }
      };

      checkNode(node);
      return smallestNode;
    },
    onMouseMove(event) {
      if (!this.jsonHierarchy) {
        return;
      }
      const canvas = this.$el.querySelector('#hierarchyCanvas');
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const { scale, offsetX, offsetY } = this.screenshotTransform;
      const hoveredNode = this.findSmallestNode(this.jsonHierarchy, mouseX, mouseY, scale, offsetX, offsetY);
      const canonicalHovered = hoveredNode ? ((this.nodeIndex && this.nodeIndex[hoveredNode._id]) || hoveredNode) : null;
      if (canonicalHovered !== this.hoveredNode) {
        this.hoveredNode = canonicalHovered;
        this.renderHierarchy();
      }
    },
    async onMouseClick(event) {
      if (!this.jsonHierarchy) {
        return;
      }
      const canvas = this.$el.querySelector('#hierarchyCanvas');
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const { scale, offsetX, offsetY } = this.screenshotTransform;

      const percentX = mouseX / canvas.width;
      const percentY = mouseY / canvas.height;
      this.mouseClickCoordinatesPercent = `(${percentX.toFixed(2)}, ${percentY.toFixed(2)})`;

      const selectedNode = this.findSmallestNode(this.jsonHierarchy, mouseX, mouseY, scale, offsetX, offsetY);
      if (selectedNode) {
        await this.handleSelectNode(selectedNode, { source: 'canvas' });
      }
    },
    onMouseLeave() {
      if (this.hoveredNode) {
        this.hoveredNode = null;
        this.renderHierarchy();
      }
    },
    async handleTreeNodeClick(node) {
      await this.handleSelectNode(node, { source: 'tree' });
    },
    async handleSelectNode(node, options = {}) {
      if (!node || !node._id) {
        return;
      }
      const { source = 'external' } = options;
      const canonicalNode = (this.nodeIndex && this.nodeIndex[node._id]) || node;
      this.selectedNode = canonicalNode;
      this.hoveredNode = null;
      const shouldScrollTree = source !== 'tree';
      this.syncTreeSelection(canonicalNode._id, { ensureVisible: shouldScrollTree });
      try {
        await this.fetchXpathLite(canonicalNode._id);
        if (this.selectedNode && this.selectedNode._id === canonicalNode._id) {
          this.selectedNode.xpath = this.xpathLite;
        }
      } catch (err) {
        console.error(err);
      }
      this.renderHierarchy();
    },
    async fetchXpathLite(nodeId) {
      try {
        const response = await fetchXpathLite(nodeId);
        if (response.success) {
          this.xpathLite = response.data;
        } else {
          throw new Error(response.message || 'Fetch xpath failed');
        }
      } catch (err) {
        console.error(err);
        this.xpathLite = '//';
      }
    },
    filterNode(value, data) {
      if (!value) return true;
      if (!data) return false;
      const candidates = [data._type, data.text, data.id, data.name, data.componentPath];
      return candidates.some((field) => field && field.toString().indexOf(value) !== -1);
    },
    copyValue(value) {
      const success = copyToClipboard(value);
      this.$message({ showClose: true, message: success ? 'Copied' : 'Copy failed', type: success ? 'success' : 'error' });
    },
    startDrag() {
      this.isDragging = true;
      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.stopDrag);
    },
    onDrag(event) {
      const leftWidth = this.$el.querySelector('.left').offsetWidth;
      this.centerWidth = Math.max(360, event.clientX - leftWidth);
    },
    stopDrag() {
      this.isDragging = false;
      document.removeEventListener('mousemove', this.onDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    },
    hoverDivider() {
      this.isDividerHovered = true;
    },
    leaveDivider() {
      this.isDividerHovered = false;
    },
    syncTreeSelection(nodeId, options = {}) {
      const { ensureVisible = true } = options;
      const tree = this.$refs.treeRef;
      if (!tree || typeof tree.setCurrentKey !== 'function') {
        return;
      }
      if (nodeId === undefined || nodeId === null) {
        tree.setCurrentKey(null);
        return;
      }
      const currentKey = typeof tree.getCurrentKey === 'function' ? tree.getCurrentKey() : null;
      if (currentKey !== nodeId) {
        tree.setCurrentKey(nodeId);
      }
      if (ensureVisible) {
        this.$nextTick(() => {
          const wrapper = this.$el.querySelector('.hierarchy-tree-wrapper');
          if (!wrapper) {
            return;
          }
          const target =
            wrapper.querySelector('.el-tree-node.is-current > .el-tree-node__content') ||
            wrapper.querySelector('.el-tree-node.is-current');
          if (target && typeof target.scrollIntoView === 'function') {
            try {
              target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
            } catch (err) {
              target.scrollIntoView();
            }
          }
        });
      }
    }
  }
});
