// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { InstagramConnectFailedError, InstagramNotConnectedError } from "@/services/instagram.errors";
import { disconnect, getAuthorizeUrl, getIntegrationStatus, handleOAuthCallback, syncNow } from "@/services/instagram.service";
import { PermissionDeniedError } from "@/services/permission.errors";

/**
 * Covers permission gating, masking, and the error paths that don't need a
 * live Meta app. The actual OAuth round trip (authorize → exchange code →
 * exchange for long-lived token → resolve identity → fetch media →
 * download images) can only be verified against a real Instagram account,
 * which this suite has no way to provide — that path is exercised manually
 * once credentials exist.
 */

const EMAIL_DOMAIN = "@instagram-svc-test.test";
const ROLE_KEY_PREFIX = "instagram-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Instagram Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "SystemSettings", action: "View" },
    { module: "SystemSettings", action: "Edit" },
  ]);
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.instagramIntegrationSetting.deleteMany({});
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("instagram.service — status and permissions", () => {
  it("starts disconnected, and never exposes an accessToken field", async () => {
    const admin = await makeFullAccessAdmin();
    const status = await getIntegrationStatus(admin.id);
    expect(status.connected).toBe(false);
    expect(status).not.toHaveProperty("accessToken");
  });

  it("a View-only admin can read status but not start OAuth, complete it, sync, or disconnect", async () => {
    const viewer = await makeAdmin([{ module: "SystemSettings", action: "View" }]);
    await expect(getIntegrationStatus(viewer.id)).resolves.toMatchObject({ connected: false });
    await expect(getAuthorizeUrl(viewer.id, "state")).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(handleOAuthCallback(viewer.id, "some-code")).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(syncNow(viewer.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(disconnect(viewer.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("an admin with no SystemSettings grant at all is rejected even for the read", async () => {
    const noAccess = await makeAdmin([]);
    await expect(getIntegrationStatus(noAccess.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("instagram.service — sync without a connection", () => {
  it("syncNow throws InstagramNotConnectedError when nothing has been connected yet", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(syncNow(admin.id)).rejects.toBeInstanceOf(InstagramNotConnectedError);
  });
});

describe("instagram.service — OAuth without Instagram app credentials configured", () => {
  it("getAuthorizeUrl fails with a clear InstagramConnectFailedError instead of building a broken URL", async () => {
    const admin = await makeFullAccessAdmin();
    // This suite's env has no INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET set,
    // which is exactly the case being asserted.
    await expect(getAuthorizeUrl(admin.id, "state")).rejects.toBeInstanceOf(InstagramConnectFailedError);
  });

  it("handleOAuthCallback fails with a clear InstagramConnectFailedError instead of an unhandled exception", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(handleOAuthCallback(admin.id, "some-code")).rejects.toBeInstanceOf(InstagramConnectFailedError);
  });
});

describe("instagram.service — disconnect", () => {
  it("clears a stored connection back to disconnected", async () => {
    const admin = await makeFullAccessAdmin();
    await prisma.instagramIntegrationSetting.upsert({
      where: { id: "global" },
      create: { id: "global", businessAccountId: "123", username: "theoristor", accessToken: "fake-token" },
      update: { businessAccountId: "123", username: "theoristor", accessToken: "fake-token" },
    });
    expect((await getIntegrationStatus(admin.id)).connected).toBe(true);

    await disconnect(admin.id);
    expect((await getIntegrationStatus(admin.id)).connected).toBe(false);
  });
});
