export const ANALYTICS_EVENTS = {
  SESSION_START: "session_start",
  SESSION_END: "session_end",

  TUTORIAL_START: "tutorial_start",
  TUTORIAL_STEP: "tutorial_step_complete",
  TUTORIAL_COMPLETE: "tutorial_complete",
  TUTORIAL_SKIP: "tutorial_skip",

  RUN_START: "run_start",
  RUN_END: "run_end",

  FLIP_USED: "flip_used",
  RECYCLER_BANK_COMPLETE: "recycler_bank_complete",

  UPGRADE_OFFER: "upgrade_offer",
  UPGRADE_PICK: "upgrade_pick",

  AD_INTERSTITIAL_OFFER: "ad_interstitial_offer",
  AD_INTERSTITIAL_START: "ad_interstitial_start",
  AD_INTERSTITIAL_COMPLETE: "ad_interstitial_complete",
  AD_INTERSTITIAL_FAIL: "ad_interstitial_fail",

  AD_REWARDED_OFFER: "ad_rewarded_offer",
  AD_REWARDED_START: "ad_rewarded_start",
  AD_REWARDED_COMPLETE: "ad_rewarded_complete",
  AD_REWARDED_FAIL: "ad_rewarded_fail",

  DAILY_ENTER: "daily_enter",
  DAILY_ATTEMPT_USED: "daily_attempt_used",
} as const;

