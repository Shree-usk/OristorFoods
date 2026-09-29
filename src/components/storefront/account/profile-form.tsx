"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastManager } from "@/lib/toast";
import { updateProfileSchema, type UpdateProfileInput } from "@/validation/profile.schema";

interface ProfileData {
  name: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  image: string | null;
}

async function fetchProfile(): Promise<ProfileData> {
  const response = await fetch("/api/account/profile", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load your profile");
  return response.json() as Promise<ProfileData>;
}

const DEFAULT_VALUES: UpdateProfileInput = { name: "", phone: "", dateOfBirth: "", image: "" };

/** STORY-034. Name/phone/DOB/photo — email is deliberately not here, see EmailChangeForm. */
export function ProfileForm() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["account-profile"], queryFn: fetchProfile });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema), defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (data) {
      reset({ name: data.name ?? "", phone: data.phone ?? "", dateOfBirth: data.dateOfBirth ?? "", image: data.image ?? "" });
    }
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      setError("root", { message: "Something went wrong. Please try again." });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["account-profile"] });
    toastManager.add({ title: "Profile saved" });
  });

  if (isPending) return <p className="text-small text-charcoal/70">Loading your profile…</p>;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <Label htmlFor="profile-name">Full name</Label>
        <Input id="profile-name" autoComplete="name" {...register("name")} />
        {errors.name && (
          <p className="mt-1 text-small text-destructive" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="profile-phone">Phone number</Label>
        <Input id="profile-phone" type="tel" autoComplete="tel" {...register("phone")} />
        {errors.phone && (
          <p className="mt-1 text-small text-destructive" role="alert">
            {errors.phone.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="profile-dob">Date of birth</Label>
        <Input id="profile-dob" type="date" {...register("dateOfBirth")} />
        {errors.dateOfBirth && (
          <p className="mt-1 text-small text-destructive" role="alert">
            {errors.dateOfBirth.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="profile-image">Photo URL</Label>
        <Input id="profile-image" type="url" placeholder="https://…" {...register("image")} />
        {errors.image && (
          <p className="mt-1 text-small text-destructive" role="alert">
            {errors.image.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="sm:self-start">
        {isSubmitting ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
