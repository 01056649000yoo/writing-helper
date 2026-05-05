import { outlineBuilderDefinition } from "./outline-builder/definition";
import { questionGeneratorDefinition } from "./question-generator/definition";
import { questionVotingDefinition } from "./question-voting/definition";
import type { ActivityDefinition, ActivityType } from "./types";

export const activityRegistry = {
  outline_builder: outlineBuilderDefinition,
  question_generator: questionGeneratorDefinition,
  question_voting: questionVotingDefinition,
} satisfies Record<ActivityType, ActivityDefinition<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>>;

export const activityDefinitions = Object.values(activityRegistry);

export function getActivityDefinition(activityType: string) {
  return activityRegistry[activityType as ActivityType] ?? activityRegistry.outline_builder;
}

