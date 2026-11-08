import { RiskNotice } from "../../primitives/risk-notice";
import { MemorableAddress } from "./MemorableAddress";
import { useUiLabels } from "../../labels";

export interface RecipientWarningProps {
  firstTime: boolean;
  /** The known address the recipient imitates, if any. */
  lookalikeOf?: string | null;
  /** The known address's avatar, so its picture can be set against the recipient's. */
  lookalikeAvatarSvg?: string;
  emphasisPick?: number | null;
  /** One more reason the send is risky, listed before the closing "double-check" line. */
  extraReason?: string;
  /** Notice text; English unless the caller passes its own. */
  labels?: RecipientWarningLabels;
  className?: string;
}

export interface RecipientWarningLabels {
  irreversible: string;
  lookalikeTitle: string;
  lookalikeScammers: string;
  lookalikeCompare: string;
  firstTime: string;
  doubleCheck: string;
}

/**
 * The one irreversible-send notice: a single headline with every reason
 * that applies listed under it, so a screen never stacks boxes that repeat
 * "cannot be undone". Informs, never blocks. A lookalike leads the list and
 * names the address it resembles, in full, so the two can be compared.
 */
export function RecipientWarning({
  firstTime,
  lookalikeOf,
  lookalikeAvatarSvg,
  emphasisPick = null,
  extraReason,
  labels: labelsProp,
  className,
}: RecipientWarningProps) {
  const contextLabels = useUiLabels();
  const labels = labelsProp ?? contextLabels.recipientWarning;
  return (
    <RiskNotice className={className}>
      <strong className="font-bold">{labels.irreversible}</strong>
      <ul className="m-0 mt-1.5 flex list-disc flex-col gap-1.5 pl-4">
        {lookalikeOf ? (
          <li>
            <span className="flex min-w-0 flex-col gap-2">
              <span>
                <strong className="font-bold">{labels.lookalikeTitle}</strong>
                <br />
                {labels.lookalikeScammers}
                <br />
                {labels.lookalikeCompare}
              </span>
              {lookalikeAvatarSvg ? (
                <MemorableAddress address={lookalikeOf} emphasisPick={emphasisPick} avatarSvg={lookalikeAvatarSvg} />
              ) : (
                <span className="break-all font-mono">{lookalikeOf}</span>
              )}
            </span>
          </li>
        ) : null}
        {firstTime ? <li>{labels.firstTime}</li> : null}
        {extraReason ? <li>{extraReason}</li> : null}
        <li>{labels.doubleCheck}</li>
      </ul>
    </RiskNotice>
  );
}
