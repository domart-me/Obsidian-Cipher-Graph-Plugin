import { ItemView, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import ForceGraph3DImport from '3d-force-graph';
import SpriteTextImport from 'three-spritetext';
import * as THREE from 'three';

const VIEW_TYPE_CIPHER_GRAPH = 'cipher-graph-view';

type CipherNode = {
  id: string;
  name: string;
  path: string;
  folder: string;
  val: number;
  color: string;
  recent: boolean;
};

type CipherLink = {
  source: string;
  target: string;
  color?: string;
};

type CipherGraphData = {
  nodes: CipherNode[];
  links: CipherLink[];
};

const palette = ['#00f5ff', '#ff2bd6', '#8b5cf6', '#39ff88', '#ffd166', '#5eead4', '#fb7185'];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function folderColor(folder: string): string {
  return palette[hashString(folder || 'root') % palette.length];
}

export default class CipherGraphPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE_CIPHER_GRAPH, (leaf) => new CipherGraphView(leaf, this));

    this.addRibbonIcon('network', 'Open Cipher Graph View', () => this.activateView());

    this.addCommand({
      id: 'open-cipher-graph-view',
      name: 'Open Cipher Graph View',
      callback: () => this.activateView(),
    });

    this.registerEvent(this.app.metadataCache.on('changed', () => this.refreshOpenViews()));
    this.registerEvent(this.app.vault.on('rename', () => this.refreshOpenViews()));
    this.registerEvent(this.app.vault.on('delete', () => this.refreshOpenViews()));
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CIPHER_GRAPH)[0];
    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE_CIPHER_GRAPH, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async refreshOpenViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CIPHER_GRAPH)) {
      const view = leaf.view;
      if (view instanceof CipherGraphView) await view.renderGraph();
    }
  }
}

class CipherGraphView extends ItemView {
  private graph: any;
  private graphEl!: HTMLDivElement;
  private statsEl!: HTMLSpanElement;
  private searchEl!: HTMLInputElement;
  private emptyEl!: HTMLDivElement;
  private resizeObserver?: ResizeObserver;

  constructor(leaf: WorkspaceLeaf, private plugin: CipherGraphPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CIPHER_GRAPH;
  }

  getDisplayText(): string {
    return 'Cipher Graph';
  }

  getIcon(): string {
    return 'network';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    const root = container.createDiv({ cls: 'cipher-graph-root' });
    const toolbar = root.createDiv({ cls: 'cipher-graph-toolbar' });
    toolbar.createDiv({ cls: 'cipher-graph-title', text: 'Cipher Graph' });
    this.statsEl = toolbar.createSpan({ cls: 'cipher-graph-stat', text: 'Scanning vault…' });

    this.searchEl = toolbar.createEl('input', {
      cls: 'cipher-graph-search',
      attr: { placeholder: 'Fokus: Note suchen…' },
    });

    const resetButton = toolbar.createEl('button', { cls: 'cipher-graph-button', text: 'Reset View' });
    const refreshButton = toolbar.createEl('button', { cls: 'cipher-graph-button', text: 'Refresh' });

    this.graphEl = root.createDiv({ cls: 'cipher-graph-canvas' });
    this.emptyEl = root.createDiv({ cls: 'cipher-graph-empty' });
    this.emptyEl.hide();

    const ForceGraph3D = ForceGraph3DImport as any;
    this.graph = ForceGraph3D({ controlType: 'orbit' })(this.graphEl)
      .backgroundColor('rgba(0,0,0,0)')
      .nodeRelSize(5)
      .nodeOpacity(0.95)
      .linkOpacity(0.38)
      .linkWidth((link: any) => link.__highlight ? 2.8 : 0.7)
      .linkDirectionalParticles((link: any) => link.__highlight ? 6 : 1)
      .linkDirectionalParticleWidth((link: any) => link.__highlight ? 2.4 : 0.8)
      .linkDirectionalParticleSpeed(0.004)
      .linkColor((link: CipherLink) => link.color || 'rgba(0,245,255,0.55)')
      .nodeThreeObject((node: CipherNode) => this.createNodeObject(node))
      .onNodeClick((node: CipherNode) => this.openNote(node))
      .onNodeHover((node: CipherNode | null) => {
        this.graphEl.style.cursor = node ? 'pointer' : 'default';
      });

    const scene = this.graph.scene();
    scene.fog = new THREE.FogExp2(0x02030a, 0.012);

    const bloomLight = new THREE.PointLight(0x00f5ff, 2.2, 420);
    bloomLight.position.set(80, 60, 120);
    scene.add(bloomLight);

    const magentaLight = new THREE.PointLight(0xff2bd6, 1.6, 380);
    magentaLight.position.set(-120, -80, 90);
    scene.add(magentaLight);

    resetButton.onclick = () => this.zoomToFit();
    refreshButton.onclick = () => this.renderGraph();
    this.searchEl.oninput = () => this.applySearchFocus();

    this.resizeObserver = new ResizeObserver(() => {
      this.graph.width(this.graphEl.clientWidth);
      this.graph.height(this.graphEl.clientHeight);
    });
    this.resizeObserver.observe(this.graphEl);

    await this.renderGraph();
  }

  async onClose() {
    this.resizeObserver?.disconnect();
    this.graph?._destructor?.();
  }

  async renderGraph() {
    const data = this.buildGraphData();
    this.statsEl.setText(`${data.nodes.length} Notes · ${data.links.length} Links`);

    if (data.nodes.length === 0) {
      this.emptyEl.setText('Keine Markdown-Notes gefunden. Fütter den Vault, dann glüht das Ding.');
      this.emptyEl.show();
    } else {
      this.emptyEl.hide();
    }

    this.graph.graphData(data);
    window.setTimeout(() => this.zoomToFit(), 420);
  }

  private buildGraphData(): CipherGraphData {
    const files = this.app.vault.getMarkdownFiles();
    const fileByPath = new Map(files.map((file) => [file.path, file]));
    const nodes: CipherNode[] = [];
    const links: CipherLink[] = [];
    const linkSet = new Set<string>();
    const now = Date.now();

    for (const file of files) {
      const folder = file.parent?.path || 'root';
      const cache = this.app.metadataCache.getFileCache(file);
      const outDegree = cache?.links?.length || 0;
      const recent = now - file.stat.mtime < 1000 * 60 * 60 * 24 * 7;

      nodes.push({
        id: file.path,
        name: file.basename,
        path: file.path,
        folder,
        val: Math.max(1.3, Math.min(9, 1.8 + outDegree * 0.32)),
        color: recent ? '#39ff88' : folderColor(folder),
        recent,
      });
    }

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      for (const rawLink of cache?.links || []) {
        const target = this.app.metadataCache.getFirstLinkpathDest(rawLink.link, file.path);
        if (!target || !fileByPath.has(target.path)) continue;
        if (target.path === file.path) continue;
        const key = [file.path, target.path].sort().join('→');
        if (linkSet.has(key)) continue;
        linkSet.add(key);
        links.push({
          source: file.path,
          target: target.path,
          color: `${folderColor(file.parent?.path || 'root')}cc`,
        });
      }
    }

    return { nodes, links };
  }

  private createNodeObject(node: CipherNode) {
    const group = new THREE.Group();
    const radius = node.val;

    const coreGeometry = new THREE.SphereGeometry(radius, 24, 24);
    const coreMaterial = new THREE.MeshLambertMaterial({
      color: node.color,
      emissive: node.color,
      emissiveIntensity: node.recent ? 1.4 : 0.8,
      transparent: true,
      opacity: 0.92,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const haloGeometry = new THREE.SphereGeometry(radius * 1.95, 24, 24);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: node.color,
      transparent: true,
      opacity: node.recent ? 0.18 : 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(haloGeometry, haloMaterial));

    const SpriteText = SpriteTextImport as any;
    const label = new SpriteText(node.name) as any;
    label.color = '#dffcff';
    label.textHeight = 4.2;
    label.position.y = radius + 6;
    label.material.depthWrite = false;
    group.add(label);

    return group;
  }

  private async openNote(node: CipherNode) {
    const file = this.app.vault.getAbstractFileByPath(node.path);
    if (!(file instanceof TFile)) {
      new Notice(`Note nicht gefunden: ${node.path}`);
      return;
    }
    await this.app.workspace.getLeaf('tab').openFile(file);
  }

  private zoomToFit() {
    if (!this.graph) return;
    this.graph.zoomToFit(720, 80);
  }

  private applySearchFocus() {
    const query = this.searchEl.value.trim().toLowerCase();
    const data = this.graph.graphData() as CipherGraphData;

    for (const node of data.nodes as any[]) {
      node.__highlight = query && (node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query));
    }

    for (const link of data.links as any[]) {
      const source = typeof link.source === 'object' ? link.source : data.nodes.find((n) => n.id === link.source);
      const target = typeof link.target === 'object' ? link.target : data.nodes.find((n) => n.id === link.target);
      link.__highlight = Boolean(query && (source?.__highlight || target?.__highlight));
    }

    this.graph
      .nodeOpacity((node: any) => !query || node.__highlight ? 1 : 0.22)
      .linkOpacity((link: any) => !query || link.__highlight ? 0.72 : 0.08)
      .linkWidth((link: any) => link.__highlight ? 2.8 : 0.7)
      .linkDirectionalParticles((link: any) => link.__highlight ? 6 : 1);

    const match = (data.nodes as any[]).find((node) => node.__highlight && Number.isFinite(node.x));
    if (match) {
      const distance = 72;
      const distRatio = 1 + distance / Math.hypot(match.x, match.y, match.z);
      this.graph.cameraPosition(
        { x: match.x * distRatio, y: match.y * distRatio, z: match.z * distRatio },
        match,
        900,
      );
    }
  }
}
