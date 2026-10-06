"use client";

import * as React from "react";
import { toast } from "sonner";
import { Settings } from "@/components/animate-ui/icons/settings";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { prefsStore, scenarioStore, seenStore, updatePrefs } from "@/lib/client/stores";
import { DEFAULT_SCALE, LETTERS, isValidScale, type GradeScale } from "@/lib/grades/scale";
import { DEFAULT_BONUS } from "@/lib/grades/gpa";

const BONUS_OPTIONS = ["0", "0.5", "1"];

export function SettingsDialog({ triggerClassName }: { triggerClassName?: string }) {
  const prefs = prefsStore.useValue();
  const [open, setOpen] = React.useState(false);
  const [scale, setScale] = React.useState<Record<string, string>>({});
  const [scaleError, setScaleError] = React.useState<string | null>(null);

  function onOpenChange(next: boolean) {
    if (next) {
      setScale(Object.fromEntries(LETTERS.map((l) => [l, String(prefs.scale[l])])));
      setScaleError(null);
    }
    setOpen(next);
  }

  function saveScale() {
    const parsed = Object.fromEntries(LETTERS.map((l) => [l, Number(scale[l])])) as GradeScale;
    if (!isValidScale(parsed)) {
      setScaleError("Cutoffs must be between 0 and 100 and go down from A to D.");
      return false;
    }
    setScaleError(null);
    updatePrefs({ scale: parsed });
    return true;
  }

  function clearData() {
    scenarioStore.set({});
    seenStore.set({});
    prefsStore.set((p) => ({
      ...p,
      scale: DEFAULT_SCALE,
      rounding: "none",
      bonus: DEFAULT_BONUS,
      levelOverrides: {},
      gpaGoal: null,
      targetLetters: {},
    }));
    setScale(Object.fromEntries(LETTERS.map((l) => [l, String(DEFAULT_SCALE[l])])));
    toast.success("Saved scenarios and settings cleared from this device.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimateIcon animateOnHover asChild>
        <DialogTrigger className={triggerClassName} aria-label="Settings">
          <Settings size={17} aria-hidden />
        </DialogTrigger>
      </AnimateIcon>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Settings</DialogTitle>
          <DialogDescription>Saved on this device only.</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Grade scale</h3>
          <div className="grid grid-cols-5 gap-2">
            {LETTERS.map((l) => (
              <div key={l} className="space-y-1">
                <Label htmlFor={`cut-${l}`} className="text-xs text-muted-foreground">
                  {l}
                </Label>
                <Input
                  id={`cut-${l}`}
                  inputMode="decimal"
                  className="h-10 px-2 text-center text-base tabular"
                  value={scale[l] ?? ""}
                  onChange={(e) => setScale((s) => ({ ...s, [l]: e.target.value }))}
                  onBlur={saveScale}
                  aria-label={`Minimum percent for ${l}`}
                />
              </div>
            ))}
          </div>
          {scaleError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {scaleError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Below {prefs.scale.D}% is an F.</p>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <Label htmlFor="rounding" className="flex flex-col items-start gap-0.5">
              <span>Round to the nearest whole percent</span>
              <span className="text-xs font-normal text-muted-foreground">89.5% counts as 90% (A-)</span>
            </Label>
            <Switch
              id="rounding"
              checked={prefs.rounding === "half-up"}
              onCheckedChange={(v) => updatePrefs({ rounding: v ? "half-up" : "none" })}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Weighted GPA bonus</h3>
          <div className="grid grid-cols-2 gap-3">
            {(["ap", "honors"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`bonus-${k}`}>{k === "ap" ? "AP" : "Honors"}</Label>
                <Select
                  value={String(prefs.bonus[k])}
                  onValueChange={(v) => updatePrefs({ bonus: { ...prefs.bonus, [k]: Number(v) } })}
                >
                  <SelectTrigger id={`bonus-${k}`} className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BONUS_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        +{Number(o).toFixed(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Applied to classes with a C or better. Change a class&apos;s level from its page.</p>
        </section>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="destructive" className="h-10" onClick={clearData}>
            Clear saved data
          </Button>
          <Button
            className="h-10"
            onClick={() => {
              if (saveScale()) setOpen(false);
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
