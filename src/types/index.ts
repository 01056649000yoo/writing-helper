export type SubjectType =
  | "생활문"
  | "일기"
  | "편지"
  | "독서감상문"
  | "기행문"
  | "관찰기록문"
  | "이야기 글"
  | "설명하는 글"
  | "주장하는 글"
  | "소개하는 글"
  | "동시"
  | "보고서";
export type GradeLevel = "저학년" | "중학년" | "고학년";
export type OutlineDepth = "simple" | "medium" | "detailed";
export type StudentLevel = "low" | "mid" | "high";
export type SessionStatus = "in_progress" | "done";
export type QueueStatus = "waiting" | "processing" | "done" | "error";

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
  grade_level: GradeLevel;
  created_at: string;
}

export interface ClassStudent {
  id: string;
  class_id: string;
  student_number: number;
  student_name: string;
  created_at: string;
}

export interface TeacherProfile {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Room {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  topic: string;
  topic_description: string;
  short_code?: string | null;
  activity_type?: string;
  activity_config?: Record<string, unknown>;
  activity_state?: Record<string, unknown>;
  subject_type: SubjectType;
  grade_level: GradeLevel;
  outline_depth: OutlineDepth;
  is_active: boolean;
  question_sets: QuestionSets | null;
  questions_generated_at: string | null;
  max_calls_per_student: number;
  expires_at: string | null;
  created_at: string;
}

export interface RoomStudent {
  id: string;
  room_id: string;
  student_number: number;
  student_name: string;
  created_at: string;
}

export interface StudentSession {
  id: string;
  room_id: string;
  room_student_id: string | null;
  student_number: number;
  student_name: string;
  level: StudentLevel | null;
  answers: Answer[];
  status: SessionStatus;
  gpt_call_count: number;
  activity_state?: Record<string, unknown>;
  submission?: Record<string, unknown>;
  result?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OutlineQueue {
  id: string;
  session_id: string;
  room_id: string;
  status: QueueStatus;
  answers: Answer[];
  result: string | null;
  position: number | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// 질문 세트 구조
export interface Question {
  step: number;
  question: string;
  type: "card" | "input" | "card+input";
  choices?: string[];
  hint?: string;
}

export interface LevelQuestions {
  questions: Question[];
}

export interface QuestionSets {
  low: LevelQuestions;
  mid: LevelQuestions;
  high: LevelQuestions;
}

// 학생 답변
export interface Answer {
  step: number;
  question: string;
  answer: string;
}
