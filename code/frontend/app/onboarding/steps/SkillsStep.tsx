"use client";

import { SkillPicker } from "@/app/ui/skill-picker/SkillPicker";
import type { SkillEditorState } from "@/app/ui/skill-picker/use-skill-editor";
import type { EvidenceSnapshot } from "@/lib/skill-suggestions";

import { StepShell } from "./StepShell";

// Spec section 5.2: the same picker as /profile/skills, saving as the user
// goes. `value` seeds the picker when the step mounts and drives Continue;
// the picker reports every change back through onChange.
export function SkillsStep({
  value,
  evidence,
  onChange,
  onContinue,
  onBack,
}: {
  value: SkillEditorState;
  evidence: EvidenceSnapshot | null;
  onChange: (next: SkillEditorState) => void;
  onContinue: () => void;
  onBack?: () => void;
}) {
  const count = value.skills.length + value.reports.filter((r) => r.status === "PENDING").length;

  return (
    <StepShell
      title="Add your skills"
      description="Search for anything you know and rate how comfortable you are. Skills found on your resume or GitHub show up as suggestions."
      onContinue={onContinue}
      onBack={onBack}
      continueDisabled={count === 0}
      disabledHint="Add at least one skill to continue."
    >
      <SkillPicker initial={value} evidence={evidence} onChange={onChange} />
    </StepShell>
  );
}
