import { t } from "@gleam/app/src/i18n/index.tsx";

/** A shell's camera instructions: text, or a function so they follow the language in use. */
export type CameraDeniedHelp = string | (() => string);

export function cameraUnavailableMessage(): string {
  return t("extension.cameraUnavailable");
}

/** `help` says where this shell lets the user turn the camera back on. */
export function CameraDeniedNotice({ help }: { help: CameraDeniedHelp }) {
  return (
    <div role="alert" className="flex flex-col gap-2 text-body leading-relaxed text-warning">
      <p>{t("extension.cameraDenied")}</p>
      <p className="text-muted">{typeof help === "function" ? help() : help}</p>
    </div>
  );
}
