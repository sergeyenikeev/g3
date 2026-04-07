export const ANALYTICS_EVENTS = {
  SESSION_START: "session_start",
  SESSION_END: "session_end",
  RETURN_AFTER_DAY: "return_after_day",

  MENU_CTA_PLAY: "menu_cta_play",
  MENU_CTA_DAILY: "menu_cta_daily",
  MENU_CTA_WORKSHOP: "menu_cta_workshop",
  MENU_CTA_LEADERBOARD: "menu_cta_leaderboard",

  TUTORIAL_START: "tutorial_start",
  TUTORIAL_STEP: "tutorial_step_complete",
  TUTORIAL_COMPLETE: "tutorial_complete",
  TUTORIAL_SKIP: "tutorial_skip",

  RUN_START: "run_start",
  RUN_END: "run_end",
  DAILY_FINISH: "daily_finish",

  FLIP_USED: "flip_used",
  DASH_USED: "dash_used",
  RECYCLER_BANK_COMPLETE: "recycler_bank_complete",
  FIRST_SCRAP: "first_scrap",
  FIRST_BANK: "first_bank",
  FIRST_UPGRADE: "first_upgrade",

  UPGRADE_OFFER: "upgrade_offer",
  UPGRADE_PICK: "upgrade_pick",

  REVIVE_OFFER: "revive_offer",
  REVIVE_ACCEPT: "revive_accept",
  REVIVE_DECLINE: "revive_decline",
  X2_RESULTS_OFFER: "x2_results_offer",
  X2_RESULTS_ACCEPT: "x2_results_accept",
  BOOSTER_FREE_USED: "booster_free_used",
  BOOSTER_REWARDED_ACCEPT: "booster_rewarded_accept",
  WORKSHOP_PURCHASE: "workshop_purchase",
  LEADERBOARD_OPEN: "leaderboard_open",
  STREAK_CLAIM: "streak_claim",
  COMEBACK_CLAIM: "comeback_claim",
  MISSION_CLAIM: "mission_claim",

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
