/**
 * Daily-missions namespace.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

export interface IMissionsNamespace {
  getDaily(userId: string, options?: MissionDailyOptions): Promise<MissionDailyResult>;
  regenerate(userId: string, options?: MissionDailyOptions): Promise<MissionDailyResult>;
}

export interface MissionDailyOptions {
  count?: number;
  difficultyMix?: import("../../../lib/missions/types").DifficultyMix;
  todayIso?: string;
}

export interface MissionDailyResult {
  missions: import("../../../lib/missions/types").DailyMission[];
  newlyCompleted: import("../../../lib/missions/types").DailyMission[];
}

/** Wire shape from the backend (snake_case ``newly_completed``);
 *  ApiStorage maps it to the camelCase ``MissionDailyResult``. */
export interface MissionDailyResultWire {
  missions: import("../../../lib/missions/types").DailyMission[];
  newly_completed: import("../../../lib/missions/types").DailyMission[];
}
