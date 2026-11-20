"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchPerfectMatchSetting, savePerfectMatchSetting, type PerfectMatchSettingInput } from "@/lib/api/admin-perfect-match-client";

type FormValues = PerfectMatchSettingInput;

const EMPTY_VALUES: FormValues = { eyebrow: "", heading: "", description: "" };

/** Admin editor for the homepage section's own intro copy — a single singleton row (PerfectMatchSetting), same editing shape as AdminFoodAcademyPageSettingsView's Hero section. */
export function AdminPerfectMatchSettingsView() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-perfect-match-setting"], queryFn: fetchPerfectMatchSetting });
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: EMPTY_VALUES });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data === undefined) return;
    reset({ eyebrow: data?.eyebrow ?? "", heading: data?.heading ?? "", description: data?.description ?? "" });
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (form: FormValues) => savePerfectMatchSetting(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-perfect-match-setting"] });
      setSaved(true);
    },
  });

  function onSubmit(form: FormValues) {
    setSaved(false);
    mutation.mutate(form);
  }

  if (isLoading) return <p className="text-small text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div>
        <Label htmlFor="pm-eyebrow">Eyebrow</Label>
        <Input id="pm-eyebrow" {...register("eyebrow")} placeholder="A little inspiration from our kitchen" />
      </div>
      <div>
        <Label htmlFor="pm-heading">Heading</Label>
        <Input id="pm-heading" {...register("heading")} placeholder="Ordinary Meals. Extraordinary Flavours." />
      </div>
      <div>
        <Label htmlFor="pm-description">Description</Label>
        <Textarea id="pm-description" {...register("description")} placeholder="Discover how a spoonful of ORISTOR can transform the meals you already love. Choose a favourite and find its perfect match." />
      </div>

      {mutation.isError && <p className="text-small text-chilli">{mutation.error instanceof Error ? mutation.error.message : "Failed to save."}</p>}
      {saved && !mutation.isPending && <p className="text-small text-green-700">Saved.</p>}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save Settings"}
      </Button>
    </form>
  );
}
