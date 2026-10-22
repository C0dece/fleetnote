/** Дерево раскладки рабочей области: панели и разделители между ними. */

export type SplitDirection = "row" | "col";

export interface PaneNode {
  type: "pane";
  id: string;
}

export interface SplitNode {
  type: "split";
  id: string;
  dir: SplitDirection;
  children: LayoutNode[];
  /** Доли ширины/высоты, сумма равна 1. */
  sizes: number[];
}

export type LayoutNode = PaneNode | SplitNode;

export interface Pane {
  id: string;
  tabs: string[];
  active: string | null;
}

/** Куда упала вкладка: в центр панели или к одному из её краёв. */
export type DropZone = "center" | "left" | "right" | "top" | "bottom";

export function makeId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function paneIds(node: LayoutNode): string[] {
  return node.type === "pane" ? [node.id] : node.children.flatMap(paneIds);
}

/** Заменить узел по id на другой (или удалить, вернув null). */
export function replaceNode(node: LayoutNode, id: string, next: LayoutNode | null): LayoutNode | null {
  if (node.id === id) return next;
  if (node.type !== "split") return node;
  const children: LayoutNode[] = [];
  const sizes: number[] = [];
  node.children.forEach((child, index) => {
    const replaced = replaceNode(child, id, next);
    if (replaced) {
      children.push(replaced);
      sizes.push(node.sizes[index] ?? 1 / node.children.length);
    }
  });
  if (children.length === 0) return null;
  if (children.length === 1) return children[0]; // схлопываем лишний уровень
  return { ...node, children, sizes: normalize(sizes) };
}

/**
 * Вставить новую панель рядом с существующей.
 * Зона решает, делить по горизонтали или вертикали и с какой стороны встать.
 */
export function insertBeside(
  root: LayoutNode,
  targetPaneId: string,
  zone: Exclude<DropZone, "center">,
  newPane: PaneNode,
): LayoutNode {
  const dir: SplitDirection = zone === "left" || zone === "right" ? "row" : "col";
  const before = zone === "left" || zone === "top";

  const build = (node: LayoutNode): LayoutNode => {
    if (node.type === "pane") {
      if (node.id !== targetPaneId) return node;
      const children = before ? [newPane, node] : [node, newPane];
      return { type: "split", id: makeId("s"), dir, children, sizes: [0.5, 0.5] };
    }
    const children = node.children.map(build);
    // Если делим в ту же сторону, что и родитель, добавляем соседа в тот же ряд
    if (node.dir === dir) {
      const index = node.children.findIndex((child) => child.type === "pane" && child.id === targetPaneId);
      if (index >= 0) {
        const at = before ? index : index + 1;
        const nextChildren = [...node.children];
        nextChildren.splice(at, 0, newPane);
        const share = node.sizes[index] ?? 1 / node.children.length;
        const sizes = [...node.sizes];
        sizes[index] = share / 2;
        sizes.splice(at, 0, share / 2);
        return { ...node, children: nextChildren, sizes: normalize(sizes) };
      }
    }
    return { ...node, children };
  };

  return build(root);
}

export function normalize(sizes: number[]): number[] {
  const total = sizes.reduce((sum, value) => sum + value, 0);
  if (!total) return sizes.map(() => 1 / sizes.length);
  return sizes.map((value) => value / total);
}

/** Найти сплит, в котором лежит узел, — нужен для перетаскивания разделителя. */
export function findSplit(node: LayoutNode, id: string): SplitNode | null {
  if (node.type !== "split") return null;
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findSplit(child, id);
    if (found) return found;
  }
  return null;
}
