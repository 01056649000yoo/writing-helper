"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withBasePath } from "@/lib/app-path";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  getIntegratedClassRooms,
  getIntegratedClassStudents,
  getIntegratedClassWorkspace,
  getIntegratedTeacherClass,
  getIntegratedTeacherClasses,
  isIntegratedLab,
} from "@/lib/lab-roster";
import { getCurrentUser } from "./auth-actions";
import type { GradeLevel } from "@/types";

export async function createClass(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (isIntegratedLab()) {
    return { error: "통합 연구소의 학급과 학생은 끄적끄적 아지트에서 관리합니다." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const gradeLevel = String(formData.get("grade_level")) as GradeLevel;
  const studentsRaw = String(formData.get("students") ?? "").trim();

  if (!name) return { error: "학급 이름을 입력해주세요." };

  const students: { number: number; name: string }[] = [];
  studentsRaw.split("\n").forEach((line, idx) => {
    const name = line.trim();
    if (name) students.push({ number: idx + 1, name });
  });
  // 빈 줄이 중간에 있으면 번호가 틀어지므로 재정렬
  const reordered = students.map((s, i) => ({ ...s, number: i + 1 }));
  if (reordered.length === 0) return { error: "학생 명단을 입력해주세요. (이름을 한 줄씩 입력)" };

  const admin = createSupabaseAdminClient();

  const { data: cls, error: clsError } = await admin
    .schema("writing_helper")
    .from("classes")
    .insert({ teacher_id: user.id, name, grade_level: gradeLevel })
    .select("id")
    .single();

  if (clsError || !cls) return { error: clsError?.message ?? "학급 생성에 실패했습니다." };

  const { error: studentsError } = await admin
    .schema("writing_helper")
    .from("class_students")
    .insert(reordered.map(s => ({ class_id: cls.id, student_number: s.number, student_name: s.name })));

  if (studentsError) return { error: "학생 명단 저장에 실패했습니다." };

  revalidatePath("/dashboard");
  redirect(withBasePath(`/dashboard/class/${cls.id}`));
}

export async function getClasses() {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  if (isIntegratedLab()) {
    return getIntegratedTeacherClasses(admin, user.id);
  }

  const { data } = await admin
    .schema("writing_helper")
    .from("classes")
    .select("*")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getClass(classId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  if (isIntegratedLab()) {
    return getIntegratedTeacherClass(admin, user.id, classId);
  }

  const { data } = await admin
    .schema("writing_helper")
    .from("classes")
    .select("*")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  return data;
}

export async function getClassStudents(classId: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  const admin = createSupabaseAdminClient();
  if (isIntegratedLab()) {
    return getIntegratedClassStudents(admin, user.id, classId);
  }

  // 소유권 확인
  const { data: cls } = await admin
    .schema("writing_helper")
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!cls) return [];
  const { data } = await admin
    .schema("writing_helper")
    .from("class_students")
    .select("*")
    .eq("class_id", classId)
    .order("student_number");
  return data ?? [];
}

export async function getClassRooms(classId: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  const admin = createSupabaseAdminClient();
  if (isIntegratedLab()) {
    return getIntegratedClassRooms(admin, user.id, classId);
  }

  // 소유권 확인
  const { data: cls } = await admin
    .schema("writing_helper")
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!cls) return [];
  const { data } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getClassWorkspace(classId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  if (isIntegratedLab()) {
    return getIntegratedClassWorkspace(admin, user.id, classId);
  }

  const { data: classRow } = await admin
    .schema("writing_helper")
    .from("classes")
    .select("*")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!classRow) return null;

  const [{ data: students }, { data: rooms }] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("class_students")
      .select("*")
      .eq("class_id", classId)
      .order("student_number"),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return { class: classRow, students: students ?? [], rooms: rooms ?? [] };
}

export async function addClassStudents(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (isIntegratedLab()) {
    return { error: "학생 명단은 끄적끄적 아지트의 학급 관리에서 수정해주세요." };
  }

  const classId = String(formData.get("class_id") ?? "").trim();
  const studentsRaw = String(formData.get("students") ?? "").trim();
  if (!classId) return { error: "학급 정보가 올바르지 않습니다." };
  if (!studentsRaw) return { error: "추가할 학생 이름을 입력해주세요." };

  const admin = createSupabaseAdminClient();
  const editable = await getEditableClassContext(admin, user.id, classId);
  if ("error" in editable) return editable;

  const names = studentsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (names.length === 0) return { error: "추가할 학생 이름을 입력해주세요." };

  const nextNumber =
    editable.students.reduce((max, student) => Math.max(max, student.student_number), 0) + 1;

  const { error } = await admin
    .schema("writing_helper")
    .from("class_students")
    .insert(
      names.map((studentName, index) => ({
        class_id: classId,
        student_number: nextNumber + index,
        student_name: studentName,
      }))
    );

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/class/${classId}`);
  return {};
}

export async function deleteClassStudent(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (isIntegratedLab()) {
    return { error: "학생 명단은 끄적끄적 아지트의 학급 관리에서 수정해주세요." };
  }

  const classId = String(formData.get("class_id") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim();
  if (!classId || !studentId) return { error: "학생 정보가 올바르지 않습니다." };

  const admin = createSupabaseAdminClient();
  const editable = await getEditableClassContext(admin, user.id, classId);
  if ("error" in editable) return editable;

  const target = editable.students.find((student) => student.id === studentId);
  if (!target) return { error: "학생을 찾을 수 없습니다." };

  const { error } = await admin
    .schema("writing_helper")
    .from("class_students")
    .delete()
    .eq("id", studentId)
    .eq("class_id", classId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/class/${classId}`);
  return {};
}

export async function deleteClass(classId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (isIntegratedLab()) {
    return { error: "학급은 끄적끄적 아지트의 학급 관리에서 관리해주세요." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("classes")
    .delete()
    .eq("id", classId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect(withBasePath("/dashboard"));
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function getEditableClassContext(admin: AdminClient, userId: string, classId: string) {
  const { data: cls } = await admin
    .schema("writing_helper")
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", userId)
    .maybeSingle();

  if (!cls) return { error: "학급을 찾을 수 없습니다." };

  const [{ data: activeRoom }, { data: students }] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("id")
      .eq("class_id", classId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("class_students")
      .select("id, student_number, student_name")
      .eq("class_id", classId)
      .order("student_number"),
  ]);

  if (activeRoom) {
    return { error: "진행 중인 활동이 있을 때는 학생 명단을 수정할 수 없습니다. 활동을 먼저 종료해주세요." };
  }

  return { students: students ?? [] };
}
