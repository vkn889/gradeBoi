"use client";

import * as React from "react";
import { Plus } from "@/components/animate-ui/icons/plus";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddAssignmentDialog({
  categories,
  onAdd,
}: {
  categories: string[];
  onAdd: (input: { name: string; category: string; score: number | null; possible: number }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState(categories[0] ?? "General");
  const [score, setScore] = React.useState("");
  const [possible, setPossible] = React.useState("100");
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(possible);
    if (possible.trim() === "" || !Number.isFinite(p) || p < 0) {
      setError("Points possible must be 0 or more.");
      return;
    }
    let s: number | null = null;
    if (score.trim() !== "") {
      s = Number(score);
      if (!Number.isFinite(s) || s < 0) {
        setError("Score must be a number, or leave it blank for not graded.");
        return;
      }
    }
    if (p === 0 && s === null) {
      setError("A 0-point assignment needs a score (extra credit).");
      return;
    }
    onAdd({ name, category: categories.includes(category) ? category : categories[0] ?? "General", score: s, possible: p });
    setOpen(false);
    setName("");
    setScore("");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AnimateIcon animateOnHover asChild>
        <DialogTrigger asChild>
          <Button variant="outline" className="h-11 px-3">
            <Plus size={16} aria-hidden />
            Add assignment
          </Button>
        </DialogTrigger>
      </AnimateIcon>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle className="text-lg">Add a hypothetical assignment</DialogTitle>
            <DialogDescription>Only changes your what-if grade. Nothing is sent to StudentVUE.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="add-name">Name</Label>
            <Input id="add-name" className="h-11 text-base" placeholder="Unit 4 Test" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="add-category" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(categories.length ? categories : ["General"]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-score">Score</Label>
              <Input id="add-score" inputMode="decimal" className="h-11 text-base tabular" placeholder="Not graded" value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-possible">Points possible</Label>
              <Input id="add-possible" inputMode="decimal" className="h-11 text-base tabular" value={possible} onChange={(e) => setPossible(e.target.value)} />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" className="h-11 w-full sm:w-auto">
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
