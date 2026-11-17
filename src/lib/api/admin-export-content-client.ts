/** /export page revamp. Fetch wrappers for /api/admin/export/{page-hero,solution-cards,process-steps}/* — mirrors admin-homepage-builder-client.ts's assertOk/throw-server-message convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

export interface ExportPageHeroSetting {
  id: string;
  backgroundImageUrl: string | null;
  backgroundImageAlt: string | null;
  eyebrow: string | null;
  headline: string | null;
  description: string | null;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
}

export type ExportPageHeroSettingInput = Partial<Omit<ExportPageHeroSetting, "id">>;

export async function fetchExportPageHeroSetting(): Promise<ExportPageHeroSetting | null> {
  const response = await fetch("/api/admin/export/page-hero");
  if (!response.ok) throw new Error(`Failed to load the export page hero (${response.status})`);
  return response.json();
}

export async function updateExportPageHeroSetting(input: ExportPageHeroSettingInput): Promise<ExportPageHeroSetting> {
  const response = await fetch("/api/admin/export/page-hero", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to save the export page hero" }));
    throw new Error(body.error ?? "Failed to save the export page hero");
  }
  return response.json();
}

export interface ExportSolutionCard {
  id: string;
  sortOrder: number;
  visible: boolean;
  icon: string;
  title: string;
  description: string;
}

export interface ExportSolutionCardInput {
  icon: string;
  title: string;
  description: string;
  visible?: boolean;
}

export async function fetchExportSolutionCards(): Promise<ExportSolutionCard[]> {
  const response = await fetch("/api/admin/export/solution-cards");
  if (!response.ok) throw new Error(`Failed to load Export Solutions cards (${response.status})`);
  return response.json();
}

export async function addExportSolutionCard(input: ExportSolutionCardInput): Promise<ExportSolutionCard> {
  const response = await fetch("/api/admin/export/solution-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to add solution card" }));
    throw new Error(body.error ?? "Failed to add solution card");
  }
  return response.json();
}

export async function updateExportSolutionCard(id: string, input: Partial<ExportSolutionCardInput>): Promise<ExportSolutionCard> {
  const response = await fetch(`/api/admin/export/solution-cards/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to update solution card" }));
    throw new Error(body.error ?? "Failed to update solution card");
  }
  return response.json();
}

export async function removeExportSolutionCard(id: string): Promise<void> {
  const response = await fetch(`/api/admin/export/solution-cards/${id}`, { method: "DELETE" });
  assertOk(response, "Failed to remove solution card");
}

export async function reorderExportSolutionCards(orderedIds: string[]): Promise<void> {
  const response = await fetch("/api/admin/export/solution-cards/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  assertOk(response, "Failed to reorder solution cards");
}

export interface ExportProcessStep {
  id: string;
  sortOrder: number;
  visible: boolean;
  icon: string;
  title: string;
  description: string;
}

export interface ExportProcessStepInput {
  icon: string;
  title: string;
  description: string;
  visible?: boolean;
}

export async function fetchExportProcessSteps(): Promise<ExportProcessStep[]> {
  const response = await fetch("/api/admin/export/process-steps");
  if (!response.ok) throw new Error(`Failed to load Export Process steps (${response.status})`);
  return response.json();
}

export async function addExportProcessStep(input: ExportProcessStepInput): Promise<ExportProcessStep> {
  const response = await fetch("/api/admin/export/process-steps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to add process step" }));
    throw new Error(body.error ?? "Failed to add process step");
  }
  return response.json();
}

export async function updateExportProcessStep(id: string, input: Partial<ExportProcessStepInput>): Promise<ExportProcessStep> {
  const response = await fetch(`/api/admin/export/process-steps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to update process step" }));
    throw new Error(body.error ?? "Failed to update process step");
  }
  return response.json();
}

export async function removeExportProcessStep(id: string): Promise<void> {
  const response = await fetch(`/api/admin/export/process-steps/${id}`, { method: "DELETE" });
  assertOk(response, "Failed to remove process step");
}

export async function reorderExportProcessSteps(orderedIds: string[]): Promise<void> {
  const response = await fetch("/api/admin/export/process-steps/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  assertOk(response, "Failed to reorder process steps");
}
