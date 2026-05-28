import type { SupabaseClient } from "@supabase/supabase-js";
import { QUESTION_CARD_SETS } from "@/features/activities/question-generator/question-card-sets";
import {
  QUESTION_CARD_ROLE_PRESETS,
  normalizeQuestionCardLabel,
} from "@/features/activities/question-generator/question-card-roles";
import type { QuestionCardRole, QuestionCardSet } from "@/features/activities/types";

type AdminClient = SupabaseClient;

type QuestionCardRoleRow = {
  id: string;
  teacher_id: string;
  label: string;
  subtitle: string;
  description: string;
  icon: string;
  sort_order: number;
  created_at?: string;
};

type QuestionCardSetRow = {
  id: string;
  teacher_id: string;
  label: string;
  description: string;
  prompts: unknown;
  role_id: string | null;
  sort_order: number;
  created_at?: string;
};

type QuestionCardSettingsTree = {
  roles: QuestionCardRole[];
  cardSets: QuestionCardSet[];
};

export async function getTeacherQuestionCardSets(
  admin: AdminClient,
  teacherId: string
): Promise<QuestionCardSet[]> {
  const tree = await getTeacherQuestionCardSettingsTree(admin, teacherId);
  return tree.cardSets;
}

export async function getTeacherQuestionCardSettingsTree(
  admin: AdminClient,
  teacherId: string
): Promise<QuestionCardSettingsTree> {
  const [rolesRes, cardSetsRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("question_card_roles")
      .select("id, teacher_id, label, subtitle, description, icon, sort_order, created_at")
      .eq("teacher_id", teacherId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .schema("writing_helper")
      .from("question_card_sets")
      .select("id, teacher_id, label, description, prompts, role_id, sort_order, created_at")
      .eq("teacher_id", teacherId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (cardSetsRes.error) {
    if (isMissingQuestionCardSetsTable(cardSetsRes.error.message)) {
      return {
        roles: buildFallbackRoles(QUESTION_CARD_SETS),
        cardSets: QUESTION_CARD_SETS,
      };
    }
    throw new Error(cardSetsRes.error.message);
  }

  if (rolesRes.error) {
    if (isMissingQuestionCardRolesTable(rolesRes.error.message)) {
      return {
        roles: buildFallbackRoles(QUESTION_CARD_SETS),
        cardSets: (cardSetsRes.data ?? []).map(normalizeQuestionCardSetRow),
      };
    }
    throw new Error(rolesRes.error.message);
  }

  let existingRoles = (rolesRes.data ?? []) as QuestionCardRoleRow[];
  let existingCardSets = (cardSetsRes.data ?? []) as QuestionCardSetRow[];

  const missingRolePresets = QUESTION_CARD_ROLE_PRESETS.filter((preset) => (
    !existingRoles.some((role) => normalizeQuestionCardLabel(role.label) === normalizeQuestionCardLabel(preset.label))
  ));

  if (missingRolePresets.length > 0) {
    const maxRoleOrder = existingRoles.reduce<number>((max, row) => Math.max(max, row.sort_order ?? 0), -1);
    const { data: insertedRoles, error: insertRolesError } = await admin
      .schema("writing_helper")
      .from("question_card_roles")
      .insert(missingRolePresets.map((preset, index) => ({
        teacher_id: teacherId,
        label: preset.label,
        subtitle: preset.subtitle,
        description: preset.description,
        icon: preset.icon,
        sort_order: maxRoleOrder + 1 + index,
      })))
      .select("id, teacher_id, label, subtitle, description, icon, sort_order, created_at");

    if (insertRolesError && !isMissingQuestionCardRolesTable(insertRolesError.message)) {
      throw new Error(insertRolesError.message);
    }

    existingRoles = [...existingRoles, ...((insertedRoles ?? []) as QuestionCardRoleRow[])];
  }

  const existingLabels = new Set(existingCardSets.map((row) => normalizeQuestionCardLabel(row.label)));
  const maxCardOrder = existingCardSets.reduce<number>((max, row) => Math.max(max, row.sort_order ?? 0), -1);
  const roleIdByLabel = new Map(
    existingRoles.map((role) => [normalizeQuestionCardLabel(role.label), role.id] as const),
  );

  const missingDefaults = QUESTION_CARD_SETS.filter((cardSet) => !existingLabels.has(normalizeQuestionCardLabel(cardSet.label)));

  if (missingDefaults.length > 0) {
    const { data: insertedSets, error: insertCardSetsError } = await admin
      .schema("writing_helper")
      .from("question_card_sets")
      .insert(missingDefaults.map((cardSet, index) => ({
        teacher_id: teacherId,
        label: cardSet.label,
        description: cardSet.description,
        prompts: cardSet.prompts,
        role_id: findRoleIdForCardLabel(roleIdByLabel, cardSet.label),
        sort_order: maxCardOrder + 1 + index,
      })))
      .select("id, teacher_id, label, description, prompts, role_id, sort_order, created_at");

    if (insertCardSetsError && !isMissingQuestionCardSetsTable(insertCardSetsError.message)) {
      throw new Error(insertCardSetsError.message);
    }

    existingCardSets = [...existingCardSets, ...((insertedSets ?? []) as QuestionCardSetRow[])];
  }

  const roleAssignments = existingCardSets
    .filter((cardSet) => !cardSet.role_id)
    .map((cardSet) => ({
      id: cardSet.id,
      role_id: findRoleIdForCardLabel(roleIdByLabel, cardSet.label),
    }))
    .filter((cardSet): cardSet is { id: string; role_id: string } => Boolean(cardSet.role_id));

  if (roleAssignments.length > 0) {
    await Promise.all(roleAssignments.map((assignment) =>
      admin
        .schema("writing_helper")
        .from("question_card_sets")
        .update({ role_id: assignment.role_id })
        .eq("id", assignment.id)
        .eq("teacher_id", teacherId)
    ));

    existingCardSets = existingCardSets.map((cardSet) => {
      const assignment = roleAssignments.find((candidate) => candidate.id === cardSet.id);
      return assignment ? { ...cardSet, role_id: assignment.role_id } : cardSet;
    });
  }

  const cardSets = existingCardSets.map(normalizeQuestionCardSetRow);
  const roles = existingRoles
    .map((role) => normalizeQuestionCardRoleRow(role, cardSets))
    .filter((role) => role.cardSetIds.length > 0);

  return {
    roles: roles.length > 0 ? roles : buildFallbackRoles(cardSets),
    cardSets,
  };
}

export function normalizeQuestionCardSetInput(input: {
  id?: string;
  label?: string;
  description?: string;
  prompts?: string[];
  roleId?: string | null;
}): QuestionCardSet {
  return {
    id: typeof input.id === "string" ? input.id : "",
    label: typeof input.label === "string" ? input.label.trim() : "",
    description: typeof input.description === "string" ? input.description.trim() : "",
    prompts: Array.isArray(input.prompts)
      ? input.prompts.map((prompt) => prompt.trim()).filter(Boolean)
      : [],
    roleId: typeof input.roleId === "string" && input.roleId.trim() ? input.roleId.trim() : null,
  };
}

export function isMissingQuestionCardSetsTable(message: string) {
  return message.includes("question_card_sets");
}

export function isMissingQuestionCardRolesTable(message: string) {
  return message.includes("question_card_roles");
}

function normalizeQuestionCardSetRow(row: QuestionCardSetRow): QuestionCardSet {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    prompts: Array.isArray(row.prompts)
      ? row.prompts.filter((prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0)
      : [],
    roleId: row.role_id ?? null,
    isDefault: isDefaultQuestionCardSetLabel(row.label),
  };
}

function normalizeQuestionCardRoleRow(row: QuestionCardRoleRow, cardSets: QuestionCardSet[]): QuestionCardRole {
  return {
    id: row.id,
    label: row.label,
    subtitle: row.subtitle,
    description: row.description,
    icon: row.icon,
    cardSetIds: cardSets.filter((cardSet) => cardSet.roleId === row.id).map((cardSet) => cardSet.id),
    isDefault: isDefaultQuestionCardRoleLabel(row.label),
  };
}

function buildFallbackRoles(cardSets: QuestionCardSet[]): QuestionCardRole[] {
  return QUESTION_CARD_ROLE_PRESETS.map((preset, index) => ({
    id: `fallback-role-${index + 1}`,
    label: preset.label,
    subtitle: preset.subtitle,
    description: preset.description,
    icon: preset.icon,
    cardSetIds: cardSets
      .filter((cardSet) => preset.cardSetLabels.some((label) => normalizeQuestionCardLabel(label) === normalizeQuestionCardLabel(cardSet.label)))
      .map((cardSet) => cardSet.id),
    isDefault: true,
  })).filter((role) => role.cardSetIds.length > 0);
}

function isDefaultQuestionCardSetLabel(label: string) {
  const normalizedLabel = normalizeQuestionCardLabel(label);
  return QUESTION_CARD_SETS.some((cardSet) => normalizeQuestionCardLabel(cardSet.label) === normalizedLabel);
}

function isDefaultQuestionCardRoleLabel(label: string) {
  const normalizedLabel = normalizeQuestionCardLabel(label);
  return QUESTION_CARD_ROLE_PRESETS.some((role) => normalizeQuestionCardLabel(role.label) === normalizedLabel);
}

function findRoleIdForCardLabel(roleIdByLabel: Map<string, string>, cardLabel: string) {
  const normalizedCardLabel = normalizeQuestionCardLabel(cardLabel);

  for (const preset of QUESTION_CARD_ROLE_PRESETS) {
    if (preset.cardSetLabels.some((label) => normalizeQuestionCardLabel(label) === normalizedCardLabel)) {
      return roleIdByLabel.get(normalizeQuestionCardLabel(preset.label)) ?? null;
    }
  }

  return null;
}
