"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createRedirectAdmin,
  deleteRedirectAdmin,
  fetchRedirect,
  updateRedirectAdmin,
  type RedirectFormInput,
} from "@/lib/api/redirect-admin-client";

const EMPTY_VALUES: RedirectFormInput = {
  sourcePath: "",
  destinationPath: "",
  statusCode: 301,
  active: true,
};

export function AdminRedirectEditorView({ redirectId }: { redirectId: string | null }) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["admin-redirect", redirectId],
    queryFn: () => fetchRedirect(redirectId!),
    enabled: Boolean(redirectId),
    refetchOnWindowFocus: false,
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<RedirectFormInput>({ defaultValues: EMPTY_VALUES });

  const seeded = useRef(false);
  useEffect(() => {
    if (!existing || seeded.current) return;
    seeded.current = true;
    reset(existing);
  }, [existing, reset]);

  const formValues = watch();

  const onSubmit = handleSubmit(async (values) => {
    setActionError(null);
    setSaved(false);
    try {
      if (redirectId) {
        await updateRedirectAdmin(redirectId, values);
        setSaved(true);
      } else {
        const created = await createRedirectAdmin(values);
        router.push(`/admin/seo/redirects/${created.id}`);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the redirect.");
    }
  });

  async function handleDelete() {
    if (!redirectId) return;
    setActionError(null);
    try {
      await deleteRedirectAdmin(redirectId);
      router.push("/admin/seo/redirects");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete the redirect.");
    }
  }

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">{redirectId ? "Edit Redirect" : "New Redirect"}</h1>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}
      {saved && <p className="mt-3 text-small text-charcoal/70">Saved.</p>}

      <form onSubmit={onSubmit} className="mt-6 grid max-w-xl gap-4">
        <div>
          <Label htmlFor="redirect-source">Source path</Label>
          <Input id="redirect-source" placeholder="/old-page" {...register("sourcePath")} />
        </div>
        <div>
          <Label htmlFor="redirect-destination">Destination path</Label>
          <Input id="redirect-destination" placeholder="/new-page" {...register("destinationPath")} />
        </div>
        <div>
          <Label htmlFor="redirect-status-code">Status code</Label>
          <Select value={String(formValues.statusCode)} onValueChange={(value) => setValue("statusCode", Number(value) as 301 | 302)}>
            <SelectTrigger id="redirect-status-code">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="301">301 — Permanent</SelectItem>
              <SelectItem value="302">302 — Temporary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={formValues.active} onCheckedChange={(checked) => setValue("active", checked === true)} id="redirect-active" />
          <Label htmlFor="redirect-active">Active</Label>
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="w-fit">
            {redirectId ? "Save" : "Create"}
          </Button>
          {redirectId && (
            <Button type="button" variant="destructive" className="w-fit" onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
