# Activity Platform Refactor

This app should grow from a single writing-outline workflow into a classroom activity platform.
The stable workflow stays the same:

1. A teacher creates a room.
2. Students enter the room.
3. Students complete the selected activity.
4. The teacher reviews individual or group results.

The variable part is the activity format inside the room.

## Core Model

`rooms` is the common execution container. It owns the teacher, class, topic, lifetime, and selected activity.

`activity_type` identifies the format that controls the room experience.

`activity_config` stores teacher-selected settings for the activity.

`activity_state` stores room-level state used by collaborative or multi-step activities.

`student_sessions` stores each student's progress, submission, and result in activity-shaped JSON.

`activity_events` stores event-like classroom actions such as question submissions, votes, revisions, and teacher curation.

## Initial Activity Formats

`outline_builder`

The current workflow. The teacher sets a writing topic, grade band, writing genre, and outline depth. Students answer generated guiding questions. GPT creates an outline from the student's answers.

`question_generator`

Students write good questions for a teacher-provided topic. The teacher reviews the collected questions and can use them for discussion, writing prompts, or a follow-up selection activity.

`question_voting`

Students review candidate questions and select the strongest ones. The teacher sees ranking, vote counts, and optional student reasoning.

## Code Shape

Activity definitions live in `src/features/activities`.

Each activity should provide:

- metadata for selection screens
- default teacher configuration
- config validation
- submission and result type definitions
- later, activity-specific teacher setup, student flow, and result components

The app router should eventually become a thin shell:

- `app/dashboard/room/new/page.tsx` chooses an activity and renders that activity's teacher setup.
- `app/room/[id]/activity/page.tsx` loads the room, finds `activityRegistry[room.activity_type]`, and renders that activity's student flow.
- teacher result pages do the same for activity-specific result views.

## Migration Strategy

1. Add `activity_type`, `activity_config`, and `activity_state` to `rooms`.
2. Add `activity_state`, `submission`, and `result` to `student_sessions`.
3. Backfill existing rooms as `outline_builder`.
4. Keep current columns temporarily so existing pages continue working.
5. Move the current outline workflow behind the `outline_builder` definition.
6. Add `question_generator` as the first new low-risk activity format.
7. Add `question_voting` after question collection is stable.

