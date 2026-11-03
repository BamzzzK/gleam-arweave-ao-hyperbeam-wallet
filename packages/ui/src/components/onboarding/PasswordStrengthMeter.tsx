import { cn } from "../../primitives/cn";
import { useUiLabels } from "../../labels";

export interface PasswordStrengthMeterProps {
  filled: number;
  /** Names for strength 1 to 4, weakest first. */
  labels?: readonly [string, string, string, string];
  className?: string;
}

const BAR_COUNT = 4;

const STRENGTH_COLORS = [
  "var(--color-beam-red)",
  "var(--color-beam-purple)",
  "var(--color-beam-sky)",
  "var(--color-beam-green)",
];

export function PasswordStrengthMeter({ filled, labels: labelsProp, className }: PasswordStrengthMeterProps) {
  const contextLabels = useUiLabels();
  const labels = labelsProp ?? contextLabels.passwordStrength;
  const clamped = Math.max(0, Math.min(BAR_COUNT, filled));
  const strengthLabel = clamped > 0 ? labels[clamped - 1] : "";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const isFilledBar = index < clamped;
          const fillLevel = clamped - 1;
          const color = isFilledBar ? STRENGTH_COLORS[fillLevel] : "var(--color-line)";

          return (
            <span
              key={index}
              className="h-[3px] flex-1 rounded-sm"
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
      {strengthLabel && (
        <span className="text-xs text-muted">{strengthLabel}</span>
      )}
    </div>
  );
}
