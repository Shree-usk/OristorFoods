"use client";

import { Button } from "@/components/ui/button";
import type { MediaFolderNode } from "@/lib/api/admin-media-client";

interface FolderTreeProps {
  nodes: MediaFolderNode[];
  selectedFolderId: string | undefined;
  onSelect: (folderId: string | undefined) => void;
  depth?: number;
}

/** Recursive folder tree — same flat-list-to-tree shape the backend already builds (media-folder.repository.ts::getFolderTree). */
export function FolderTree({ nodes, selectedFolderId, onSelect, depth = 0 }: FolderTreeProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <li key={node.id}>
          <Button
            type="button"
            variant={selectedFolderId === node.id ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => onSelect(node.id)}
          >
            {node.name}
          </Button>
          {node.children.length > 0 && (
            <FolderTree nodes={node.children} selectedFolderId={selectedFolderId} onSelect={onSelect} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}
