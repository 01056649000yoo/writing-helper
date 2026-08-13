import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { GradeLevel } from "@/types";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export const isIntegratedLab = () => process.env.LAB_SSO_ENABLED === "true";

export function inferGradeLevel(className: string): GradeLevel {
  const match = className.match(/([1-6])\s*학년/);
  const grade = Number(match?.[1] ?? 0);
  if (grade >= 1 && grade <= 2) return "저학년";
  if (grade >= 5 && grade <= 6) return "고학년";
  return "중학년";
}

export async function getIntegratedTeacherClasses(admin: AdminClient, teacherId: string) {
  const { data, error } = await admin
    .from("classes")
    .select("id, teacher_id, name, created_at")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return [];
  return (data ?? []).map((classRow) => ({
    ...classRow,
    grade_level: inferGradeLevel(classRow.name),
    roster_source: "agit" as const,
  }));
}

export async function getIntegratedTeacherClass(
  admin: AdminClient,
  teacherId: string,
  classId: string,
) {
  const { data } = await admin
    .from("classes")
    .select("id, teacher_id, name, created_at")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    grade_level: inferGradeLevel(data.name),
    roster_source: "agit" as const,
  };
}

export async function getIntegratedClassStudents(
  admin: AdminClient,
  teacherId: string,
  classId: string,
) {
  const classRow = await getIntegratedTeacherClass(admin, teacherId, classId);
  if (!classRow) return [];

  return listIntegratedClassStudents(admin, classId);
}

async function listIntegratedClassStudents(admin: AdminClient, classId: string) {

  const { data, error } = await admin
    .from("students")
    .select("id, class_id, name, created_at")
    .eq("class_id", classId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")
    .order("id")
    .limit(100);

  if (error) return [];
  return (data ?? []).map((student, index) => ({
    id: student.id,
    class_id: student.class_id,
    student_number: index + 1,
    student_name: student.name,
    created_at: student.created_at,
    agit_student_id: student.id,
  }));
}

export async function getIntegratedClassRooms(
  admin: AdminClient,
  teacherId: string,
  classId: string,
) {
  const classRow = await getIntegratedTeacherClass(admin, teacherId, classId);
  if (!classRow) return [];

  return listIntegratedClassRooms(admin, teacherId, classId);
}

async function listIntegratedClassRooms(
  admin: AdminClient,
  teacherId: string,
  classId: string,
) {

  const { data, error } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("*")
    .eq("teacher_id", teacherId)
    .eq("agit_class_id", classId)
    .order("created_at", { ascending: false })
    .limit(100);

  return error ? [] : data ?? [];
}

export async function getIntegratedClassWorkspace(
  admin: AdminClient,
  teacherId: string,
  classId: string,
) {
  const classRow = await getIntegratedTeacherClass(admin, teacherId, classId);
  if (!classRow) return null;

  const [students, rooms] = await Promise.all([
    listIntegratedClassStudents(admin, classId),
    listIntegratedClassRooms(admin, teacherId, classId),
  ]);
  return { class: classRow, students, rooms };
}

export async function findIntegratedStudentByRosterIdentity(
  admin: AdminClient,
  classId: string,
  studentNumber: number,
  studentName: string,
) {
  const { data, error } = await admin
    .from("students")
    .select("id, name")
    .eq("class_id", classId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")
    .order("id")
    .limit(100);

  if (error) return null;
  const student = (data ?? [])[studentNumber - 1];
  if (!student || student.name !== studentName.trim()) return null;
  return student;
}
