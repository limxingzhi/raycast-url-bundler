import { act, create } from "react-test-renderer";
import type { ReactTestInstance, ReactTestRenderer } from "react-test-renderer";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Rendered {
  tree: ReactTestRenderer;
  root: ReactTestInstance;
  unmount: () => void;
}

export async function renderWithHooks(element: ReactElement): Promise<Rendered> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element, { createNodeMock: () => ({}) });
  });

  return { tree, root: tree.root, unmount: () => act(() => tree.unmount()) };
}

export function byType(root: ReactTestInstance, type: string | ((props: Record<string, unknown>) => unknown)) {
  return root.findAll((node) => node.type === type);
}

export function byProp(root: ReactTestInstance, matcher: Record<string, unknown>, maxDepth = 50): ReactTestInstance[] {
  const matches: ReactTestInstance[] = [];

  const visit = (node: ReactTestInstance, depth: number) => {
    if (Object.entries(matcher).every(([key, value]) => node.props[key] === value)) {
      matches.push(node);
    }
    if (depth >= maxDepth) return;
    node.children.forEach((child) => {
      if (typeof child !== "string") visit(child as ReactTestInstance, depth + 1);
    });
  };

  visit(root, 0);
  return matches;
}

type AnyElement = ReactElement<{ children?: ReactNode } & Record<string, unknown>>;

function flattenElement(node: ReactNode, found: AnyElement[] = []): AnyElement[] {
  if (node === null || node === undefined || typeof node === "boolean") return found;
  if (Array.isArray(node)) {
    node.forEach((child) => flattenElement(child, found));
    return found;
  }
  if (!isValidElement(node)) return found;

  const element = node as AnyElement;
  found.push(element);
  Object.values(element.props).forEach((value) => {
    if (isValidElement(value)) flattenElement(value, found);
  });
  flattenElement(element.props.children, found);
  return found;
}

function unrenderedActions(root: ReactTestInstance): AnyElement[] {
  const nodes = [root, ...root.findAll(() => true)];
  const seen = new Set<AnyElement>();

  return nodes.flatMap((node) => {
    if (!isValidElement(node.props.actions)) return [];
    return flattenElement(node.props.actions as ReactNode).filter((element) => {
      if (seen.has(element)) return false;
      seen.add(element);
      return true;
    });
  });
}

export function actionElements(root: ReactTestInstance, title: string): AnyElement | undefined {
  return unrenderedActions(root).find((element) => element.props.title === title);
}

export function actionTitles(root: ReactTestInstance): string[] {
  const rendered = titlesOf(root);
  const unrendered = unrenderedActions(root)
    .map((element) => element.props.title)
    .filter((title): title is string => typeof title === "string");

  return [...rendered, ...unrendered];
}

export function hostByProp(root: ReactTestInstance, matcher: Record<string, unknown>): ReactTestInstance[] {
  const seen = new Set<ReactTestInstance>();
  return byProp(root, matcher).filter((node) => {
    if (typeof node.type !== "string" || seen.has(node)) return false;
    seen.add(node);
    return true;
  });
}

export function titlesOf(root: ReactTestInstance): string[] {
  return root.findAll((node) => typeof node.props.title === "string").map((node) => node.props.title as string);
}

export async function invoke(fn: () => unknown): Promise<void> {
  await act(async () => {
    await fn();
  });
}

export const flush = () => act(async () => undefined);

export { vi };
