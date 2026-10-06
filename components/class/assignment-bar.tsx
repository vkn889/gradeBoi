"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, type Transition, type Variants } from "motion/react";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { CircleCheck } from "@/components/animate-ui/icons/circle-check";
import { X } from "@/components/animate-ui/icons/x";
import { RotateCcw } from "@/components/animate-ui/icons/rotate-ccw";
import { Trash2 } from "@/components/animate-ui/icons/trash-2";
import { ChevronDown } from "@/components/animate-ui/icons/chevron-down";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Adapted from the Animate UI "Management Bar": pagination steps between assignments,
// action buttons expand to show their label on hover, and the CTA moves the assignment
// to another category.

const BUTTON_MOTION_CONFIG = {
  initial: "rest",
  whileHover: "hover",
  whileTap: "tap",
  whileFocus: "hover",
  variants: {
    rest: { maxWidth: "44px" },
    hover: {
      maxWidth: "150px",
      transition: { type: "spring", stiffness: 200, damping: 35, delay: 0.1 },
    },
    tap: { scale: 0.95 },
  },
  transition: { type: "spring", stiffness: 250, damping: 25 },
} as const;

const LABEL_VARIANTS: Variants = {
  rest: { opacity: 0, x: 4 },
  hover: { opacity: 1, x: 0, visibility: "visible" },
  tap: { opacity: 1, x: 0, visibility: "visible" },
};

const LABEL_TRANSITION: Transition = { type: "spring", stiffness: 200, damping: 25 };

type Action = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone: "neutral" | "success" | "danger";
  disabled?: boolean;
};

const TONES: Record<Action["tone"], string> = {
  neutral: "bg-muted text-foreground hover:bg-accent",
  success: "bg-success-wash text-success",
  danger: "bg-danger-wash text-danger",
};

export type AssignmentBarProps = {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  canRevert: boolean;
  onFullCredit: () => void;
  onZero: () => void;
  onRevert: () => void;
  onRemove: () => void;
  category: string;
  categories: string[];
  onMove: (category: string) => void;
  assignmentName: string;
};

export function AssignmentBar(props: AssignmentBarProps) {
  const { index, total, onPrev, onNext, category, categories, onMove, assignmentName } = props;

  const actions: Action[] = [
    { label: "Full credit", icon: <CircleCheck size={20} className="shrink-0" />, onClick: props.onFullCredit, tone: "success" },
    { label: "Zero", icon: <X size={20} className="shrink-0" />, onClick: props.onZero, tone: "neutral" },
    { label: "Revert", icon: <RotateCcw size={20} className="shrink-0" />, onClick: props.onRevert, tone: "neutral", disabled: !props.canRevert },
    { label: "Remove", icon: <Trash2 size={20} className="shrink-0" />, onClick: props.onRemove, tone: "danger" },
  ];

  return (
    <div className="@container/wrapper flex w-full justify-center" role="toolbar" aria-label={`Actions for ${assignmentName}`}>
      <div className="flex w-full flex-col items-center gap-y-2 rounded-2xl border border-border bg-background p-2 shadow-lg @xl/wrapper:w-fit @xl/wrapper:flex-row">
        <div className="mx-auto flex shrink-0 flex-col items-center @lg/wrapper:flex-row">
          <div className="flex h-11 items-center">
            <button
              type="button"
              disabled={index <= 0}
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:text-muted-foreground/30"
              onClick={onPrev}
              aria-label="Previous assignment"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="mx-1 flex items-center space-x-1 text-sm tabular" aria-live="polite">
              <span className="sr-only">Assignment</span>
              <SlidingNumber className="text-foreground" padStart number={index + 1} />
              <span className="text-muted-foreground">/ {String(total).padStart(2, "0")}</span>
            </div>
            <button
              type="button"
              disabled={index >= total - 1}
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:text-muted-foreground/30"
              onClick={onNext}
              aria-label="Next assignment"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="mx-3 hidden h-6 w-px rounded-full bg-border @lg/wrapper:block" />

          <motion.div layout layoutRoot className="mx-auto flex flex-wrap justify-center gap-2 sm:flex-nowrap">
            {actions.map((a) => (
              <AnimateIcon key={a.label} animateOnHover asChild>
                <motion.button
                  type="button"
                  {...BUTTON_MOTION_CONFIG}
                  onClick={a.onClick}
                  disabled={a.disabled}
                  className={cn(
                    "flex h-11 items-center space-x-2 overflow-hidden whitespace-nowrap rounded-lg px-3 py-2 transition-colors disabled:opacity-40",
                    TONES[a.tone],
                  )}
                  aria-label={a.label}
                >
                  {a.icon}
                  <motion.span variants={LABEL_VARIANTS} transition={LABEL_TRANSITION} className="invisible text-sm">
                    {a.label}
                  </motion.span>
                </motion.button>
              </AnimateIcon>
            ))}
          </motion.div>
        </div>

        <div className="mx-3 hidden h-6 w-px rounded-full bg-border @xl/wrapper:block" />

        <DropdownMenu>
          <AnimateIcon animateOnHover asChild>
            <DropdownMenuTrigger asChild>
              <motion.button
                type="button"
                whileTap={{ scale: 0.975 }}
                className="flex h-11 w-full min-w-0 items-center justify-center rounded-lg bg-foreground px-3 py-2 text-sm text-background transition-colors duration-300 hover:bg-foreground/85 @xl/wrapper:w-auto"
                aria-label={`Move to another category. Current: ${category}`}
              >
                <span className="mr-1 shrink-0 opacity-70">Move to:</span>
                <span className="truncate">{category}</span>
                <div className="mx-3 h-5 w-px shrink-0 rounded-full bg-background/30" />
                <ChevronDown size={16} className="-mr-1 shrink-0 text-gold-soft" />
              </motion.button>
            </DropdownMenuTrigger>
          </AnimateIcon>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel>Category</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={category} onValueChange={onMove}>
              {categories.map((c) => (
                <DropdownMenuRadioItem key={c} value={c} className="min-h-10">
                  {c}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
