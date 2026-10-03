"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  fetchNotificationTemplates,
  previewNotificationTemplate,
  updateNotificationTemplate,
  type NotificationTemplate,
} from "@/lib/api/admin-system-settings-client";

/** The {{variableName}} placeholders in a body — drives the sample-value editor below. Mirrors notification-template-admin.service.ts::extractMergeFields exactly, client-side. */
function extractMergeFields(body: string): string[] {
  const matches = body.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((match) => match[1]!))];
}

/**
 * STORY-054. The admin authoring UI over NotificationTemplate — the
 * model, seed data, and merge-field render engine all already existed
 * from STORY-032. List + an edit drawer with a live preview fed by
 * admin-typed sample values for each {{...}} placeholder found in the
 * body (real business data isn't known ahead of time here).
 */
export function NotificationTemplatesPanel() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["admin-settings-notification-templates"], queryFn: fetchNotificationTemplates });

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template key</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Active</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-charcoal/70">
                Loading…
              </TableCell>
            </TableRow>
          ) : (
            (data ?? []).map((template) => (
              <TableRow key={template.id}>
                <TableCell>{template.templateKey}</TableCell>
                <TableCell>{template.channel}</TableCell>
                <TableCell>
                  <Badge variant={template.isActive ? "default" : "outline"}>{template.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(template);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {editing && (
        <TemplateEditorDrawer
          template={editing}
          open={open}
          onOpenChange={setOpen}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin-settings-notification-templates"] })}
        />
      )}
    </div>
  );
}

function TemplateEditorDrawer({
  template,
  open,
  onOpenChange,
  onChanged,
}: {
  template: NotificationTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [subject, setSubject] = useState(template.subject ?? "");
  const [body, setBody] = useState(template.body);
  const [isActive, setIsActive] = useState(template.isActive);
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [seededTemplateId, setSeededTemplateId] = useState(template.id);
  if (template.id !== seededTemplateId) {
    setSeededTemplateId(template.id);
    setSubject(template.subject ?? "");
    setBody(template.body);
    setIsActive(template.isActive);
    setSampleValues({});
    setPreview(null);
    setError(null);
  }

  const mergeFields = extractMergeFields(body);

  async function handlePreview() {
    setError(null);
    try {
      setPreview(await previewNotificationTemplate(body, sampleValues));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render the preview.");
    }
  }

  async function handleSave() {
    setError(null);
    try {
      await updateNotificationTemplate(template.id, { subject: subject || null, body, isActive });
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the template.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {template.templateKey} — {template.channel}
          </SheetTitle>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          {error && <p className="text-small text-destructive">{error}</p>}

          {template.channel === "Email" && (
            <div>
              <Label htmlFor="template-subject">Subject</Label>
              <Input id="template-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
            </div>
          )}

          <div>
            <Label htmlFor="template-body">Body</Label>
            <Textarea id="template-body" rows={8} value={body} onChange={(event) => setBody(event.target.value)} />
            <p className="mt-1 text-caption text-muted-foreground">Use {"{{variableName}}"} for merge fields.</p>
          </div>

          <CheckboxOption label="Active" checked={isActive} onCheckedChange={setIsActive} />

          {mergeFields.length > 0 && (
            <div>
              <Label>Sample values for preview</Label>
              <div className="mt-1 grid gap-2">
                {mergeFields.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-small text-charcoal/70">{`{{${field}}}`}</span>
                    <Input
                      aria-label={`{{${field}}}`}
                      value={sampleValues[field] ?? ""}
                      onChange={(event) => setSampleValues((prev) => ({ ...prev, [field]: event.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={handlePreview}>
            Preview
          </Button>

          {preview !== null && (
            <div className="rounded-md border border-dashed border-border p-3">
              <p className="text-small font-medium text-charcoal">Preview</p>
              <p className="mt-1 whitespace-pre-wrap text-small text-charcoal/80">{preview}</p>
            </div>
          )}
        </div>

        <SheetFooter>
          <Button onClick={handleSave}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
