import * as categoryRepository from "@/repositories/category.repository";
import type { CategoryTreeNode } from "@/repositories/category.repository";

function pruneInactive(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes
    .filter((node) => node.status === "Active")
    .map((node) => ({ ...node, children: pruneInactive(node.children) }));
}

export async function getCategoryTreeForStorefront(): Promise<CategoryTreeNode[]> {
  const tree = await categoryRepository.getCategoryTree();
  return pruneInactive(tree);
}
