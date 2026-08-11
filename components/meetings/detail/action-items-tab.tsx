"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { updateActionItem, deleteActionItem } from "@/lib/actions/action-items";
import type { ActionItem, ActionItemStatus } from "@/lib/types";

const STATUS_VARIANT: Record<ActionItemStatus, "warning" | "primary" | "success"> = {
  pending: "warning",
  in_progress: "primary",
  done: "success",
};

export function ActionItemsTab({ meetingId, items }: { meetingId: string; items: ActionItem[] }) {
  const [, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Action items detected from the transcript will appear here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col divide-y divide-border p-0">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <Input
              defaultValue={item.task}
              onBlur={(e) => {
                if (e.target.value !== item.task) {
                  startTransition(() => updateActionItem(item.id, meetingId, { task: e.target.value }));
                }
              }}
              className="min-w-[180px] flex-1 border-transparent bg-transparent px-0 font-medium hover:border-border focus:border-border"
            />
            <Input
              defaultValue={item.assignee ?? ""}
              placeholder="Assignee"
              onBlur={(e) => {
                if (e.target.value !== (item.assignee ?? "")) {
                  startTransition(() => updateActionItem(item.id, meetingId, { assignee: e.target.value || null }));
                }
              }}
              className="w-32 text-sm"
            />
            <Input
              type="date"
              defaultValue={item.due_date ?? ""}
              onChange={(e) => startTransition(() => updateActionItem(item.id, meetingId, { due_date: e.target.value || null }))}
              className="w-40 text-sm"
            />
            <Select
              defaultValue={item.status}
              onValueChange={(v) => startTransition(() => updateActionItem(item.id, meetingId, { status: v as ActionItemStatus }))}
            >
              <SelectTrigger className="w-36">
                <SelectValue>
                  <Badge variant={STATUS_VARIANT[item.status]}>{item.status.replace("_", " ")}</Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => startTransition(() => deleteActionItem(item.id, meetingId))}
              className="text-muted-foreground hover:text-danger"
              aria-label="Delete action item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
