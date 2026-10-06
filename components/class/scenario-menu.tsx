"use client";

import * as React from "react";
import { Layers } from "@/components/animate-ui/icons/layers";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Saved scenarios per class (best case, worst case, ...). */
export function ScenarioMenu({
  names,
  active,
  onSelect,
  onSaveAs,
  onNew,
  onDelete,
}: {
  names: string[];
  active: string;
  onSelect: (name: string) => void;
  onSaveAs: (name: string) => void;
  onNew: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [dialog, setDialog] = React.useState<null | "save" | "new">(null);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function open(kind: "save" | "new") {
    setName(kind === "save" ? `${active} copy` : "");
    setError(null);
    setDialog(kind);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim().slice(0, 40);
    if (!n) return setError("Give it a name.");
    if (names.includes(n)) return setError("You already have a scenario with that name.");
    if (dialog === "save") onSaveAs(n);
    else onNew(n);
    setDialog(null);
  }

  return (
    <>
      <DropdownMenu>
        <AnimateIcon animateOnHover asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 max-w-56 px-3">
              <Layers size={16} aria-hidden />
              <span className="truncate">{active}</span>
            </Button>
          </DropdownMenuTrigger>
        </AnimateIcon>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuLabel>Scenarios</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={active} onValueChange={onSelect}>
            {names.map((n) => (
              <DropdownMenuRadioItem key={n} value={n} className="min-h-10">
                {n}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-10" onSelect={() => open("save")}>
            Save a copy as…
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-10" onSelect={() => open("new")}>
            New blank scenario…
          </DropdownMenuItem>
          {names.length > 1 && (
            <DropdownMenuItem className="min-h-10" variant="destructive" onSelect={() => onDelete(active)}>
              Delete “{active}”
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{dialog === "save" ? "Save a copy" : "New scenario"}</DialogTitle>
              <DialogDescription>For example: best case, worst case, skip the retake.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="scenario-name">Name</Label>
              <Input id="scenario-name" className="h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              {error && (
                <p role="alert" className="text-sm font-medium text-danger">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" className="h-11">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
