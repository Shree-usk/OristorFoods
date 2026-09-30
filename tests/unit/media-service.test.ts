// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  MediaAssetMissingAltTextError,
  MediaFolderNotEmptyError,
} from "@/services/media.errors";
import {
  createFolder,
  deleteAsset,
  deleteFolder,
  selectAssetForPicker,
  updateAsset,
  uploadAssets,
} from "@/services/media.service";
import { LocalDiskStorageProvider } from "@/services/storage/local-disk-storage.provider";

const EMAIL_DOMAIN = "@media-svc-test.test";
const ROLE_KEY_PREFIX = "media-svc-test-role-";
let sequence = 0;
const uploadedUrls: string[] = [];
const storage = new LocalDiskStorageProvider();

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Media Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "MediaLibrary", action: "View" },
    { module: "MediaLibrary", action: "Edit" },
    { module: "MediaLibrary", action: "Delete" },
  ]);
  return makeAdminUser(role.id);
}

const tinyPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.mediaAsset.deleteMany({ where: { uploadedBy: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.mediaFolder.deleteMany({ where: { name: { startsWith: "Media Svc Test" } } });
  // The real LocalDiskStorageProvider writes real files — clean up what this file wrote.
  await Promise.all(uploadedUrls.splice(0).map((url) => storage.delete(url)));
});

describe("media.service", () => {
  it("uploadAssets: a wrong-type/oversized file fails independently, the valid file still succeeds", async () => {
    const admin = await makeFullAccessAdmin();

    const result = await uploadAssets(admin.id, [
      { buffer: tinyPngBuffer, originalName: "photo.png", mimeType: "image/png" },
      { buffer: Buffer.from("not an image"), originalName: "notes.txt", mimeType: "text/plain" },
      { buffer: Buffer.alloc(21 * 1024 * 1024), originalName: "huge.png", mimeType: "image/png" },
    ]);
    uploadedUrls.push(...result.succeeded.map((asset) => asset.url));

    expect(result.succeeded).toHaveLength(1);
    expect(result.succeeded[0].originalName).toBe("photo.png");
    expect(result.succeeded[0].type).toBe("Image");
    expect(result.failed).toHaveLength(2);
    expect(result.failed.map((failure) => failure.originalName).sort()).toEqual(["huge.png", "notes.txt"]);

    const auditEntries = await prisma.auditLog.findMany({ where: { actorId: admin.id, action: "media_uploaded" } });
    expect(auditEntries).toHaveLength(1);
  });

  it("selectAssetForPicker rejects an asset with no alt text and succeeds once one is set", async () => {
    const admin = await makeFullAccessAdmin();
    const uploaded = await uploadAssets(admin.id, [{ buffer: tinyPngBuffer, originalName: "no-alt.png", mimeType: "image/png" }]);
    uploadedUrls.push(...uploaded.succeeded.map((asset) => asset.url));
    const asset = uploaded.succeeded[0];

    await expect(selectAssetForPicker(admin.id, asset.id)).rejects.toBeInstanceOf(MediaAssetMissingAltTextError);

    await updateAsset(admin.id, asset.id, { altText: "A tiny test image" });
    const selected = await selectAssetForPicker(admin.id, asset.id);
    expect(selected.altText).toBe("A tiny test image");
  });

  it("deleteAsset removes the DB row and the underlying file", async () => {
    const admin = await makeFullAccessAdmin();
    const uploaded = await uploadAssets(admin.id, [{ buffer: tinyPngBuffer, originalName: "to-delete.png", mimeType: "image/png" }]);
    const asset = uploaded.succeeded[0];

    await deleteAsset(admin.id, asset.id);

    const found = await prisma.mediaAsset.findUnique({ where: { id: asset.id } });
    expect(found).toBeNull();
    const auditEntry = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "media_deleted" } });
    expect(auditEntry).not.toBeNull();
  });

  it("folder delete is rejected while non-empty and succeeds once emptied", async () => {
    const admin = await makeFullAccessAdmin();
    const folder = await createFolder(admin.id, "Media Svc Test Folder", null);
    const uploaded = await uploadAssets(admin.id, [{ buffer: tinyPngBuffer, originalName: "in-folder.png", mimeType: "image/png" }]);
    const asset = uploaded.succeeded[0];
    await updateAsset(admin.id, asset.id, { folderId: folder.id });

    await expect(deleteFolder(admin.id, folder.id)).rejects.toBeInstanceOf(MediaFolderNotEmptyError);

    await deleteAsset(admin.id, asset.id);
    await expect(deleteFolder(admin.id, folder.id)).resolves.toBeUndefined();

    const auditEntry = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "media_folder_deleted" } });
    expect(auditEntry).not.toBeNull();
  });

  it("denies upload/delete/folder actions to an admin without the right MediaLibrary permission", async () => {
    const viewOnlyRole = await makeRole([{ module: "MediaLibrary", action: "View" }]);
    const viewer = await makeAdminUser(viewOnlyRole.id);

    await expect(uploadAssets(viewer.id, [{ buffer: tinyPngBuffer, originalName: "x.png", mimeType: "image/png" }])).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    await expect(createFolder(viewer.id, "Media Svc Test Denied Folder", null)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
