import { outlineBuilderDefinition } from "./outline-builder/definition";
import { questionGeneratorDefinition } from "./question-generator/definition";
import { questionVotingDefinition } from "./question-voting/definition";
import { oneLineShareDefinition } from "./one-line-share/definition";
import { hanjaWritingDefinition } from "./hanja-writing/definition";
import { isActivityType } from "./types";

export const activityRegistry = {
  outline_builder: outlineBuilderDefinition,
  question_generator: questionGeneratorDefinition,
  question_voting: questionVotingDefinition,
  one_line_share: oneLineShareDefinition,
  hanja_writing: hanjaWritingDefinition,
} as const;

export const activityDefinitions = Object.values(activityRegistry);

export function getActivityDefinition(activityType: string) {
  return isActivityType(activityType) ? activityRegistry[activityType] : activityRegistry.outline_builder;
}
