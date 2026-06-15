import { outlineBuilderDefinition } from "./outline-builder/definition";
import { questionGeneratorDefinition } from "./question-generator/definition";
import { questionVotingDefinition } from "./question-voting/definition";
import { oneLineShareDefinition } from "./one-line-share/definition";
import { hanjaWritingDefinition } from "./hanja-writing/definition";
import { wordGameDefinition } from "./word-game/definition";
import type { ActivityDefinition, ActivityType } from "./types";

export const activityRegistry = {
  outline_builder: outlineBuilderDefinition,
  question_generator: questionGeneratorDefinition,
  question_voting: questionVotingDefinition,
  one_line_share: oneLineShareDefinition,
  hanja_writing: hanjaWritingDefinition,
  word_game: wordGameDefinition,
} satisfies Record<ActivityType, ActivityDefinition<any, any, any>>;

export const activityDefinitions = Object.values(activityRegistry);

export function getActivityDefinition(activityType: string) {
  return activityRegistry[activityType as ActivityType] ?? activityRegistry.outline_builder;
}
