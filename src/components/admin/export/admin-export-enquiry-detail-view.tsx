"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assignEnquiry,
  addEnquiryNote,
  convertToDistributorAccount,
  fetchAssignableAdmins,
  fetchEnquiry,
  fetchEnquiryActivity,
  replyToEnquiry,
  updateEnquiryStatus,
  type ExportEnquiryStatusValue,
} from "@/lib/api/admin-export-client";

const STATUS_LABELS: Record<ExportEnquiryStatusValue, string> = { New: "New", InDiscussion: "In Discussion", Quoted: "Quoted", Won: "Won", Lost: "Lost" };

/** The service's own assertValidStatusTransition is the real guard — this list only drives which buttons render, matching RequirePermission's own "UI convenience, not the security boundary" doc comment. */
const NEXT_STATUSES: Record<ExportEnquiryStatusValue, ExportEnquiryStatusValue[]> = {
  New: ["InDiscussion", "Lost"],
  InDiscussion: ["Quoted", "Lost"],
  Quoted: ["Won", "Lost"],
  Won: [],
  Lost: [],
};

/** STORY-058. Mirrors admin-customer-detail-view.tsx's runAction() idiom. */
export function AdminExportEnquiryDetailView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [convertRegion, setConvertRegion] = useState("");

  const { data: enquiry } = useQuery({ queryKey: ["admin-export-enquiry", id], queryFn: () => fetchEnquiry(id) });
  const { data: activity } = useQuery({ queryKey: ["admin-export-enquiry-activity", id], queryFn: () => fetchEnquiryActivity(id) });
  const { data: admins } = useQuery({ queryKey: ["admin-export-assignable-admins"], queryFn: fetchAssignableAdmins });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-export-enquiry", id] });
    queryClient.invalidateQueries({ queryKey: ["admin-export-enquiry-activity", id] });
  }

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      invalidate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    }
  }

  if (!enquiry) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">{enquiry.companyName}</h1>
        <Badge variant={enquiry.status === "Won" ? "default" : enquiry.status === "Lost" ? "destructive" : "outline"}>{STATUS_LABELS[enquiry.status]}</Badge>
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-h5 font-heading text-charcoal">Company info</h2>
          <dl className="mt-2 space-y-1 text-small text-charcoal/80">
            <div>
              <dt className="inline font-medium">Contact: </dt>
              <dd className="inline">{enquiry.contactName}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Email: </dt>
              <dd className="inline">{enquiry.contactEmail}</dd>
            </div>
            {enquiry.contactPhone && (
              <div>
                <dt className="inline font-medium">Phone: </dt>
                <dd className="inline">{enquiry.contactPhone}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-medium">Country: </dt>
              <dd className="inline">{enquiry.country}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Products of interest: </dt>
              <dd className="inline">{enquiry.productsOfInterest}</dd>
            </div>
            {enquiry.volumeEstimate && (
              <div>
                <dt className="inline font-medium">Volume estimate: </dt>
                <dd className="inline">{enquiry.volumeEstimate}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-medium">Submitted: </dt>
              <dd className="inline">{new Date(enquiry.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
          <p className="mt-3 whitespace-pre-wrap text-small text-charcoal/80">{enquiry.message}</p>
        </section>

        <section>
          <h2 className="text-h5 font-heading text-charcoal">Status &amp; assignment</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {NEXT_STATUSES[enquiry.status].map((next) => (
              <Button key={next} size="sm" variant={next === "Lost" ? "destructive" : "default"} onClick={() => runAction(() => updateEnquiryStatus(id, next))}>
                Move to {STATUS_LABELS[next]}
              </Button>
            ))}
            {enquiry.status === "Won" && !enquiry.distributorAccount && (
              <div className="flex items-end gap-2">
                <div>
                  <Label htmlFor="convert-region">Region</Label>
                  <Input id="convert-region" className="w-40" value={convertRegion} onChange={(event) => setConvertRegion(event.target.value)} />
                </div>
                <Button
                  size="sm"
                  disabled={!convertRegion.trim()}
                  onClick={() => runAction(async () => { await convertToDistributorAccount(id, convertRegion); setConvertRegion(""); })}
                >
                  Convert to Distributor Account
                </Button>
              </div>
            )}
            {enquiry.distributorAccount && <Badge>Converted to Distributor Account</Badge>}
          </div>

          <div className="mt-4">
            <Label htmlFor="assign-to">Assigned to</Label>
            <Select
              value={enquiry.assignedTo?.id ?? "unassigned"}
              onValueChange={(value) => runAction(() => assignEnquiry(id, value === "unassigned" ? null : value))}
            >
              <SelectTrigger id="assign-to" className="w-56">
                <SelectValue>{(selected: string | null) => (selected && selected !== "unassigned" ? (admins?.find((a) => a.id === selected)?.name ?? "Unassigned") : "Unassigned")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {(admins ?? []).map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4">
            <h3 className="text-h6 font-heading text-charcoal">Reply to enquirer</h3>
            <Label htmlFor="reply-subject" className="mt-2 block">
              Subject
            </Label>
            <Input id="reply-subject" value={replySubject} onChange={(event) => setReplySubject(event.target.value)} />
            <Label htmlFor="reply-body" className="mt-2 block">
              Message
            </Label>
            <Textarea id="reply-body" value={replyBody} onChange={(event) => setReplyBody(event.target.value)} />
            <Button
              size="sm"
              className="mt-2"
              disabled={!replySubject.trim() || !replyBody.trim()}
              onClick={() => runAction(async () => { await replyToEnquiry(id, replySubject, replyBody); setReplySubject(""); setReplyBody(""); })}
            >
              Send reply
            </Button>
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-h5 font-heading text-charcoal">Internal notes</h2>
          <p className="text-small text-charcoal/60">Never visible to the enquirer.</p>
          <ul className="mt-2 space-y-2">
            {(enquiry.notes ?? []).map((note) => (
              <li key={note.id} className="rounded-md border border-border p-2 text-small">
                <p className="text-charcoal/60">
                  {note.author.name} · {new Date(note.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-charcoal">{note.body}</p>
              </li>
            ))}
          </ul>
          <Textarea className="mt-2" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Add an internal note…" />
          <Button
            size="sm"
            className="mt-2"
            disabled={!noteBody.trim()}
            onClick={() => runAction(async () => { await addEnquiryNote(id, noteBody); setNoteBody(""); })}
          >
            Add note
          </Button>
        </section>

        <section>
          <h2 className="text-h5 font-heading text-charcoal">Activity</h2>
          <ul className="mt-2 space-y-2 text-small text-charcoal/80">
            {(activity ?? []).map((entry) => (
              <li key={entry.id}>
                <span className="text-charcoal/60">{new Date(entry.createdAt).toLocaleString()} · </span>
                {entry.actor?.email ?? "(system)"} — {entry.action}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
