// "Group families" on Today's Queue (components/home/PatientQueue.tsx): while the switch is on, staff
// drag patients' cards onto each other (or onto a family's box) to make one family, or a family
// member's card out of its box onto empty space to take them out of the family. Cards are only dragged.
// Each drop is shown at once as it will be saved (previewFamilies). Nothing is saved until the switch is turned off again; then the
// patients leaving go first (POST /api/family/leave), then the picked patients become one family
// (POST /api/family/group). A family left with one member is dissolved by the host.

export interface FamilyMember {
  patient_id: number;
  family?: string | null;
}

export interface GroupingDraft {
  // Patients (ids) that become one family, highlighted on their cards.
  selected: number[];
  // Patients (ids) taken out of their family first.
  leaving: number[];
}

export const EMPTY_DRAFT: GroupingDraft = { selected: [], leaving: [] };

// The most patients grouped at once (MAX_FAMILY_PICKS in apps/backend/routes/family.js).
export const MAX_GROUP = 20;

const without = (ids: number[], id: number) => ids.filter((other) => other !== id);
const withIds = (ids: number[], more: number[]) => Array.from(new Set([...ids, ...more]));

// The patient and, when they are in a family they are not leaving, the rest of that family in the queue.
function withFamily(patient: FamilyMember, queue: FamilyMember[], leaving: number[]): number[] {
  if (!patient.family || leaving.includes(patient.patient_id)) return [patient.patient_id];
  return queue
    .filter((other) => other.family === patient.family && !leaving.includes(other.patient_id))
    .map((other) => other.patient_id);
}

// A card dropped onto another: both (with the target's family) join the picked group. A member of
// another family leaves that family for it.
export function dropOnPatient(
  draft: GroupingDraft, dragged: FamilyMember, target: FamilyMember, queue: FamilyMember[],
): GroupingDraft {
  if (dragged.patient_id === target.patient_id) return draft;
  const sameFamily = !!dragged.family && dragged.family === target.family;
  // Already one family, and nothing picked yet: nothing to do.
  if (sameFamily && draft.selected.length === 0 && !draft.leaving.includes(dragged.patient_id)) return draft;
  const leavesFamily = !!dragged.family && !sameFamily;
  const leaving = leavesFamily ? withIds(draft.leaving, [dragged.patient_id]) : without(draft.leaving, dragged.patient_id);
  return {
    selected: withIds(draft.selected, [...withFamily(target, queue, leaving), dragged.patient_id]),
    leaving,
  };
}

// A card dropped on empty space in the queue (out of its box, like an app out of a folder): a family
// member leaves their family; anyone else is just un-picked.
export function dropOutside(draft: GroupingDraft, dragged: FamilyMember): GroupingDraft {
  return {
    selected: without(draft.selected, dragged.patient_id),
    leaving: dragged.family ? withIds(draft.leaving, [dragged.patient_id]) : draft.leaving,
  };
}

// What turning the switch off saves: who leaves their family, and the new family (null when fewer
// than two are picked).
export function draftChanges(draft: GroupingDraft): { leave: number[]; group: number[] | null } {
  return {
    leave: draft.leaving.filter((id) => !draft.selected.includes(id) || draft.selected.length >= 2),
    group: draft.selected.length >= 2 ? draft.selected : null,
  };
}

// Shown on a new family's box until it is saved and the host gives it a letter.
export const NEW_FAMILY = "New";

// The queue as it will be once the draft is saved, so a card dropped into a box is shown in it (and
// one dragged out, outside it) straight away. The picked patients take the family most of them are
// already in (as the host does), else a new one.
export function previewFamilies<T extends FamilyMember>(patients: T[], draft: GroupingDraft): T[] {
  if (!draft.selected.length && !draft.leaving.length) return patients;
  const { leave, group } = draftChanges(draft);
  const counts = new Map<string, number>();
  let family: string | null = null;
  let best = 0;
  for (const id of group ?? []) {
    const current = patients.find((patient) => patient.patient_id === id)?.family;
    if (!current || leave.includes(id)) continue;
    const count = (counts.get(current) ?? 0) + 1;
    counts.set(current, count);
    if (count > best) { best = count; family = current; }
  }
  return patients.map((patient) => {
    if (group?.includes(patient.patient_id)) return { ...patient, family: family ?? NEW_FAMILY };
    if (leave.includes(patient.patient_id)) return { ...patient, family: null };
    return patient;
  });
}
