import { cn } from "../../primitives/cn";
import { useUiLabels } from "../../labels";

/** Step progress indicator — plain dots, no numbers or percentage. */
export interface StepDotsProps {
  total: number;
  current: number;
  /** Accessible name; defaults to "Step n of m". */
  label?: string;
  className?: string;
}

export function StepDots({ total, current, label, className }: StepDotsProps) {
  const labels = useUiLabels();
  return (
    <div
      className={cn("flex items-center gap-[5px]", className)}
      aria-label={label ?? labels.stepOf(current, total)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-[5px] w-[5px] rounded-full bg-line",
            index === current - 1 && "bg-foreground",
          )}
        />
      ))}
    </div>
  );
}
