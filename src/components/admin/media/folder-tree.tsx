"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaFolderNode } from "@/lib/api/admin-media-client";

export const ASSET_DRAG_MIME = "application/x-oristor-media-asset-id";

interface FolderTreeProps {
  nodes: MediaFolderNode[];
  selectedFolderId: string | undefined;
  onSelect: (folderId: string | undefined) => void;
  /** Omit to disable drop targets entirely (e.g. in picker mode). */
  onDropAsset?: (assetId: string, folderId: string) => void;
  depth?: number;
}

/** Recursive folder tree — same flat-list-to-tree shape the backend already builds (media-folder.repository.ts::getFolderTree). */
export function FolderTree({ nodes, selectedFolderId, onSelect, onDropAsset, depth = 0 }: FolderTreeProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <li key={node.id}>
          <Button
            type="button"
            variant={selectedFolderId === node.id ? "secondary" : "ghost"}
            size="sm"
            className={cn("w-full justify-start", dragOverId === node.id && "ring-2 ring-ring")}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => onSelect(node.id)}
            onDragOver={
              onDropAsset
                ? (event) => {
                    if (!event.dataTransfer.types.includes(ASSET_DRAG_MIME)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverId(node.id);
                  }
                : undefined
            }
            onDragLeave={onDropAsset ? () => setDragOverId((current) => (current === node.id ? null : current)) : undefined}
            onDrop={
              onDropAsset
                ? (event) => {
                    event.preventDefault();
                    setDragOverId(null);
                    const assetId = event.dataTransfer.getData(ASSET_DRAG_MIME);
                    if (assetId) onDropAsset(assetId, node.id);
                  }
                : undefined
            }
          >
            {node.name}
          </Button>
          {node.children.length > 0 && (
            <FolderTree
              nodes={node.children}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onDropAsset={onDropAsset}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
