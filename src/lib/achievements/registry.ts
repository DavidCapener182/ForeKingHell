import { getClubDistanceBenchmark, type ClubBenchmarkLevelKey } from "@/lib/club-benchmarks";

import type {
  Achievement,
  AchievementCategory,
  AchievementTier,
  AchievementTriggerType,
} from "./types";

export const ACHIEVEMENT_REGISTRY_VERSION = "2026-05-16-bronze-silver-gold-expansion-v1";

const TIER_XP: Record<AchievementTier, number> = {
  bronze: 50,
  silver: 100,
  gold: 200,
  platinum: 400,
  diamond: 800,
  hidden: 50,
};

function achievement(
  id: string,
  name: string,
  description: string,
  category: AchievementCategory,
  tier: AchievementTier,
  triggerType: AchievementTriggerType,
  targetValue?: number,
  xp = TIER_XP[tier],
  clubTypes?: string[],
): Achievement {
  return {
    id,
    name,
    description,
    category,
    tier,
    xp,
    repeatable: false,
    hidden: tier === "hidden" || category === "hidden",
    triggerType,
    targetValue,
    clubTypes,
  };
}

const IRON_CLUBS = ["4i", "5i", "6i", "7i", "8i", "9i"];
const WEDGE_CLUBS = ["pw", "gw", "sw", "lw"];

export const CORE_ACHIEVEMENTS: Achievement[] = (
  [
    achievement(
      "first_import",
      "First Import",
      "Import your first Rapsodo session.",
      "data",
      "bronze",
      "session",
      1,
      100,
    ),
    achievement(
      "data_golfer",
      "Data Golfer",
      "Import 5 Rapsodo sessions.",
      "data",
      "bronze",
      "session",
      5,
      100,
    ),
    achievement(
      "range_rat",
      "Range Rat",
      "Import 10 Rapsodo sessions.",
      "data",
      "silver",
      "session",
      10,
      200,
    ),
    achievement(
      "first_10_shot_session",
      "Warm-Up Complete",
      "Import a session with 10+ shots.",
      "data",
      "bronze",
      "session",
      10,
    ),
    achievement(
      "first_25_shot_session",
      "Proper Session",
      "Import a session with 25+ shots.",
      "data",
      "silver",
      "session",
      25,
    ),
    achievement(
      "first_50_shot_session",
      "Full Grind",
      "Import a session with 50+ shots.",
      "data",
      "gold",
      "session",
      50,
    ),
    achievement(
      "driver_day",
      "Driver Day",
      "Log 20+ driver shots in one session.",
      "driver",
      "bronze",
      "session",
      20,
    ),
    achievement(
      "fivewood_day",
      "5 Wood Day",
      "Log 10+ 5W shots in one session.",
      "fiveWood",
      "bronze",
      "session",
      10,
    ),
    achievement(
      "iron_day",
      "Iron Day",
      "Log 30+ iron shots in one session.",
      "data",
      "silver",
      "session",
      30,
    ),
    achievement(
      "wedge_day",
      "Wedge Day",
      "Log 30+ wedge shots in one session.",
      "data",
      "silver",
      "session",
      30,
    ),
    achievement(
      "bag_test",
      "Bag Test",
      "Use 5+ different clubs in one session.",
      "data",
      "silver",
      "session",
      5,
    ),
    achievement(
      "focused_session",
      "Focused Session",
      "Hit 20+ shots with one club in a session.",
      "consistency",
      "silver",
      "session",
      20,
    ),

    achievement(
      "driver_total_200",
      "Driver 200 Total",
      "Hit a driver 200+ yd total.",
      "power",
      "bronze",
      "singleShot",
      200,
    ),
    achievement(
      "driver_total_210",
      "Driver 210 Total",
      "Hit a driver 210+ yd total.",
      "power",
      "silver",
      "singleShot",
      210,
    ),
    achievement(
      "driver_total_220",
      "Driver 220 Total",
      "Hit a driver 220+ yd total.",
      "power",
      "gold",
      "singleShot",
      220,
    ),
    achievement(
      "driver_total_230",
      "Driver 230 Total",
      "Hit a driver 230+ yd total.",
      "power",
      "platinum",
      "singleShot",
      230,
    ),
    achievement(
      "driver_total_240",
      "Driver 240 Total",
      "Hit a driver 240+ yd total.",
      "power",
      "diamond",
      "singleShot",
      240,
    ),
    achievement(
      "driver_total_250",
      "250 Dream",
      "Hit a driver 250+ yd total.",
      "power",
      "diamond",
      "singleShot",
      250,
      1000,
    ),
    achievement(
      "driver_carry_190",
      "Carry 190",
      "Carry driver 190+ yd.",
      "power",
      "bronze",
      "singleShot",
      190,
    ),
    achievement(
      "driver_carry_200",
      "200 Carry Club",
      "Carry driver 200+ yd.",
      "power",
      "silver",
      "singleShot",
      200,
    ),
    achievement(
      "driver_carry_210",
      "210 Carry Club",
      "Carry driver 210+ yd.",
      "power",
      "gold",
      "singleShot",
      210,
    ),
    achievement(
      "driver_carry_220",
      "220 Carry Club",
      "Carry driver 220+ yd.",
      "power",
      "platinum",
      "singleShot",
      220,
    ),
    achievement(
      "driver_ball_speed_130",
      "Ball Speed 130",
      "Reach 130+ mph ball speed with driver.",
      "power",
      "bronze",
      "singleShot",
      130,
    ),
    achievement(
      "driver_ball_speed_135",
      "Ball Speed 135",
      "Reach 135+ mph ball speed with driver.",
      "power",
      "silver",
      "singleShot",
      135,
    ),
    achievement(
      "driver_ball_speed_140",
      "Ball Speed 140",
      "Reach 140+ mph ball speed with driver.",
      "power",
      "gold",
      "singleShot",
      140,
    ),
    achievement(
      "driver_club_speed_90",
      "90mph Club",
      "Reach 90+ mph club speed with driver.",
      "power",
      "silver",
      "singleShot",
      90,
    ),
    achievement(
      "driver_club_speed_95",
      "95mph Club",
      "Reach 95+ mph club speed with driver.",
      "power",
      "gold",
      "singleShot",
      95,
    ),
    achievement(
      "driver_club_speed_100",
      "100mph Club",
      "Reach 100+ mph club speed with driver.",
      "power",
      "diamond",
      "singleShot",
      100,
    ),
    achievement(
      "driver_bomb_straight",
      "Bomb and Straight",
      "Hit driver 220+ yd total and finish within 10 yd of target.",
      "power",
      "platinum",
      "singleShot",
      220,
    ),

    achievement(
      "driver_launch_window_single",
      "Driver Launch Window",
      "Launch driver between 13 and 17 deg.",
      "launch",
      "bronze",
      "singleShot",
    ),
    achievement(
      "driver_launch_locked_5",
      "Launch Locked I",
      "Average 13-17 deg launch over 5 driver shots in one session.",
      "launch",
      "silver",
      "session",
      5,
    ),
    achievement(
      "driver_launch_locked_10",
      "Launch Locked II",
      "Average 13-17 deg launch over 10 driver shots in one session.",
      "launch",
      "gold",
      "session",
      10,
    ),
    achievement(
      "driver_no_low_bullets",
      "No Low Bullets",
      "Hit 10 driver shots in one session with none under 10 deg launch.",
      "launch",
      "gold",
      "session",
      10,
    ),
    achievement(
      "driver_no_moon_balls",
      "No Moon Balls",
      "Hit 10 driver shots in one session with none over 21 deg launch.",
      "launch",
      "gold",
      "session",
      10,
    ),
    achievement(
      "driver_apex_20",
      "Healthy Flight",
      "Send a driver apex over 20 yd.",
      "launch",
      "silver",
      "singleShot",
      20,
    ),
    achievement(
      "driver_apex_30",
      "Towering Drive",
      "Send a driver apex over 30 yd.",
      "launch",
      "gold",
      "singleShot",
      30,
    ),
    achievement(
      "driver_penetrating_flight",
      "Penetrating Flight",
      "Launch driver 12-15 deg with 200+ yd carry.",
      "launch",
      "gold",
      "singleShot",
      200,
    ),

    achievement(
      "driver_offline_20",
      "Playable Drive",
      "Finish a driver within 20 yd of target.",
      "accuracy",
      "bronze",
      "singleShot",
      20,
    ),
    achievement(
      "driver_offline_10",
      "Fairway Shape",
      "Finish a driver within 10 yd of target.",
      "accuracy",
      "silver",
      "singleShot",
      10,
    ),
    achievement(
      "driver_offline_5",
      "Laser Drive",
      "Finish a driver within 5 yd of target.",
      "accuracy",
      "gold",
      "singleShot",
      5,
    ),
    achievement(
      "driver_no_left_10",
      "No Left Miss",
      "Hit 10 driver shots in one session with none more than 20 yd left.",
      "accuracy",
      "gold",
      "session",
      10,
    ),
    achievement(
      "driver_no_right_10",
      "No Block Session",
      "Hit 10 driver shots in one session with none more than 20 yd right.",
      "accuracy",
      "gold",
      "session",
      10,
    ),
    achievement(
      "driver_tight_pattern_10",
      "Tight Driver Pattern",
      "Keep a 10-driver offline spread to 30 yd or less.",
      "accuracy",
      "gold",
      "session",
      30,
    ),
    achievement(
      "driver_neutral_session",
      "Neutral Driver Session",
      "Average driver side carry between 5 yd left and 5 yd right over 20 shots.",
      "accuracy",
      "platinum",
      "session",
      20,
    ),

    achievement(
      "driver_smash_145",
      "Smash 1.45",
      "Record driver smash factor of 1.45+.",
      "strike",
      "bronze",
      "singleShot",
      1.45,
    ),
    achievement(
      "driver_smash_148",
      "Pure Driver",
      "Record driver smash factor of 1.48+.",
      "strike",
      "silver",
      "singleShot",
      1.48,
    ),
    achievement(
      "driver_smash_150",
      "Perfect-ish Driver",
      "Record driver smash factor of 1.50+.",
      "strike",
      "gold",
      "singleShot",
      1.5,
    ),
    achievement(
      "driver_smash_streak",
      "Strike Streak",
      "Hit 5 driver shots in a row with smash factor 1.45+.",
      "strike",
      "gold",
      "session",
      5,
    ),
    achievement(
      "driver_upward_attack",
      "Upward Strike",
      "Record driver attack angle of +2 deg or better.",
      "strike",
      "silver",
      "singleShot",
      2,
    ),
    achievement(
      "driver_path_neutral",
      "Neutral Path Driver",
      "Deliver driver club path between -1 and +4 deg.",
      "strike",
      "gold",
      "singleShot",
    ),
    achievement(
      "driver_path_session",
      "Path Calmed Down",
      "Average driver path +1 to +4 deg over 10 shots.",
      "strike",
      "platinum",
      "session",
      10,
    ),

    achievement(
      "fivewood_unlocked",
      "5W Unlocked",
      "Log your first 5W shot.",
      "fiveWood",
      "bronze",
      "singleShot",
      1,
    ),
    achievement(
      "fivewood_carry_150",
      "Clean Sweep",
      "Carry 5W 150+ yd.",
      "fiveWood",
      "bronze",
      "singleShot",
      150,
    ),
    achievement(
      "fivewood_carry_160",
      "160 Carry 5W",
      "Carry 5W 160+ yd.",
      "fiveWood",
      "silver",
      "singleShot",
      160,
    ),
    achievement(
      "fivewood_carry_170",
      "170 Carry 5W",
      "Carry 5W 170+ yd.",
      "fiveWood",
      "gold",
      "singleShot",
      170,
    ),
    achievement(
      "fivewood_carry_180",
      "180 Carry 5W",
      "Carry 5W 180+ yd.",
      "fiveWood",
      "platinum",
      "singleShot",
      180,
    ),
    achievement(
      "fivewood_total_190",
      "190 Total 5W",
      "Hit 5W 190+ yd total.",
      "fiveWood",
      "silver",
      "singleShot",
      190,
    ),
    achievement(
      "fivewood_total_200",
      "200 Total 5W",
      "Hit 5W 200+ yd total.",
      "fiveWood",
      "gold",
      "singleShot",
      200,
    ),
    achievement(
      "fivewood_no_top_zone",
      "No Top Zone",
      "Hit 10 5W shots in one session with none under 120 yd carry.",
      "fiveWood",
      "gold",
      "session",
      10,
    ),
    achievement(
      "fivewood_launch_window",
      "Fairway Wood Flight",
      "Launch 5W between 11 and 16 deg.",
      "fiveWood",
      "silver",
      "singleShot",
    ),
    achievement(
      "fivewood_sweep_grass",
      "Sweep the Grass",
      "Launch 5W over 12 deg and carry it 160+ yd.",
      "fiveWood",
      "gold",
      "singleShot",
      160,
    ),
    achievement(
      "fivewood_laser",
      "5W Laser",
      "Finish a 5W within 10 yd of target.",
      "fiveWood",
      "gold",
      "singleShot",
      10,
    ),
    achievement(
      "fivewood_stock_built",
      "5W Stock Built",
      "Hit 20 5W shots with 165+ yd average carry and 20 yd carry spread.",
      "fiveWood",
      "platinum",
      "session",
      20,
    ),

    achievement(
      "first_stock_number",
      "First Stock Number",
      "Build the first reliable stock carry.",
      "gapping",
      "bronze",
      "stockYardage",
      1,
    ),
    achievement(
      "driver_stocked",
      "Driver Stocked",
      "Build a reliable driver stock carry.",
      "gapping",
      "silver",
      "stockYardage",
      1,
    ),
    achievement(
      "fivewood_stocked",
      "5W Stocked",
      "Build a reliable 5W stock carry.",
      "gapping",
      "silver",
      "stockYardage",
      1,
    ),
    achievement(
      "iron_stocked",
      "Iron Stocked",
      "Build a reliable stock carry for any iron.",
      "gapping",
      "silver",
      "stockYardage",
      1,
    ),
    achievement(
      "full_bag_started",
      "Full Bag Started",
      "Build stock yardages for 5 clubs.",
      "gapping",
      "silver",
      "stockYardage",
      5,
    ),
    achievement(
      "full_bag_mapped",
      "Full Bag Mapped",
      "Build stock yardages for every active club.",
      "gapping",
      "platinum",
      "stockYardage",
      1,
      500,
    ),
    achievement(
      "top_end_fixed",
      "Top End Fixed",
      "Confirm Driver to 5W to 5i gaps.",
      "gapping",
      "gold",
      "stockYardage",
    ),
    achievement(
      "scoring_gap_fixed",
      "Scoring Gap Fixed",
      "Confirm PW to 9i to 8i gaps.",
      "gapping",
      "gold",
      "stockYardage",
    ),
    achievement(
      "eight_nine_gap_healthy",
      "8/9 Gap Healthy",
      "Keep 8i 8-12 yd longer than 9i.",
      "gapping",
      "gold",
      "stockYardage",
    ),
    achievement(
      "reliable_bag",
      "Reliable Bag",
      "Get every active club above 70 confidence.",
      "gapping",
      "platinum",
      "stockYardage",
      70,
    ),
    achievement(
      "benchmark_first_average",
      "Average Marker",
      "Build a reliable stock carry that reaches the Average benchmark for any club.",
      "gapping",
      "silver",
      "stockYardage",
      1,
    ),
    achievement(
      "benchmark_first_good",
      "Good Marker",
      "Build a reliable stock carry that reaches the Good benchmark for any club.",
      "gapping",
      "gold",
      "stockYardage",
      2,
    ),
    achievement(
      "benchmark_first_advanced",
      "Advanced Marker",
      "Build a reliable stock carry that reaches the Advanced benchmark for any club.",
      "gapping",
      "platinum",
      "stockYardage",
      3,
    ),
    achievement(
      "benchmark_first_tour",
      "Tour Marker",
      "Build a reliable stock carry that reaches the Tour benchmark for any club.",
      "gapping",
      "diamond",
      "stockYardage",
      4,
    ),
    achievement(
      "benchmark_bag_average",
      "Average Bag",
      "Average the Average benchmark or better across 5 reliable stock clubs.",
      "gapping",
      "gold",
      "stockYardage",
      1,
    ),
    achievement(
      "benchmark_bag_good",
      "Good Bag",
      "Average the Good benchmark or better across 5 reliable stock clubs.",
      "gapping",
      "platinum",
      "stockYardage",
      2,
    ),
    achievement(
      "benchmark_bag_advanced",
      "Advanced Bag",
      "Average the Advanced benchmark or better across 5 reliable stock clubs.",
      "gapping",
      "diamond",
      "stockYardage",
      3,
    ),

    achievement(
      "ten_shot_sample",
      "10-Shot Sample",
      "Log 10 shots with one club.",
      "consistency",
      "bronze",
      "rollingWindow",
      10,
    ),
    achievement(
      "twenty_shot_sample",
      "20-Shot Sample",
      "Log 20 shots with one club.",
      "consistency",
      "silver",
      "rollingWindow",
      20,
    ),
    achievement(
      "fifty_shot_sample",
      "50-Shot Sample",
      "Log 50 shots with one club.",
      "consistency",
      "gold",
      "rollingWindow",
      50,
    ),
    achievement(
      "carry_consistency",
      "Carry Consistency",
      "Keep 10 shots with one club inside a 10 yd carry spread.",
      "consistency",
      "gold",
      "session",
      10,
    ),
    achievement(
      "total_consistency",
      "Total Consistency",
      "Keep 10 shots with one club inside a 15 yd total spread.",
      "consistency",
      "gold",
      "session",
      15,
    ),
    achievement(
      "launch_consistency",
      "Launch Consistency",
      "Keep 10 shots with one club inside a 4 deg launch spread.",
      "consistency",
      "gold",
      "session",
      4,
    ),
    achievement(
      "direction_consistency",
      "Direction Consistency",
      "Keep 10 shots with one club inside a 5 deg launch-direction spread.",
      "consistency",
      "gold",
      "session",
      5,
    ),
    achievement(
      "apex_consistency",
      "Apex Consistency",
      "Keep 10 shots with one club inside a 30 ft apex spread.",
      "consistency",
      "platinum",
      "session",
      30,
    ),
    achievement(
      "no_outlier_session",
      "No Outlier Session",
      "Log a 20-shot session without extreme outliers.",
      "consistency",
      "platinum",
      "session",
      20,
    ),

    achievement(
      "distance_up_5",
      "Distance Up",
      "Improve stock driver carry by 5 yd.",
      "progress",
      "gold",
      "progress",
      5,
    ),
    achievement(
      "distance_up_10",
      "Distance Up II",
      "Improve stock driver carry by 10 yd.",
      "progress",
      "platinum",
      "progress",
      10,
    ),
    achievement(
      "ball_speed_gain",
      "Ball Speed Gain",
      "Improve driver ball speed by 5 mph.",
      "progress",
      "gold",
      "progress",
      5,
    ),
    achievement(
      "launch_fixed",
      "Launch Fixed",
      "Move driver launch into the target window.",
      "progress",
      "gold",
      "progress",
    ),
    achievement(
      "path_improved",
      "Path Improved",
      "Reduce driver path magnitude by 30%.",
      "progress",
      "platinum",
      "progress",
      30,
    ),
    achievement(
      "side_carry_improved",
      "Side Carry Improved",
      "Improve side dispersion by 25%.",
      "progress",
      "platinum",
      "progress",
      25,
    ),
    achievement(
      "hook_reduced",
      "Hook Reduced",
      "Reduce average left miss by 25%.",
      "progress",
      "platinum",
      "progress",
      25,
    ),
    achievement(
      "hook_exorcist",
      "Hook Exorcist",
      "Reduce average left miss by 50%.",
      "progress",
      "diamond",
      "progress",
      50,
    ),

    achievement(
      "break_100",
      "Break 100",
      "Shoot under 100.",
      "scoring",
      "bronze",
      "roundScorecard",
      100,
    ),
    achievement(
      "break_95",
      "Break 95",
      "Shoot under 95.",
      "scoring",
      "silver",
      "roundScorecard",
      95,
    ),
    achievement("break_90", "Break 90", "Shoot under 90.", "scoring", "gold", "roundScorecard", 90),
    achievement(
      "break_85",
      "Break 85",
      "Shoot under 85.",
      "scoring",
      "platinum",
      "roundScorecard",
      85,
    ),
    achievement(
      "break_80",
      "Break 80",
      "Shoot under 80.",
      "scoring",
      "diamond",
      "roundScorecard",
      80,
    ),
    achievement(
      "sub_40_nine",
      "Sub-40 Nine",
      "Shoot 39 or better over 9 holes.",
      "scoring",
      "gold",
      "roundScorecard",
      39,
    ),
    achievement(
      "clean_nine",
      "Clean Nine",
      "Play 9 holes with no triples or worse.",
      "scoring",
      "silver",
      "roundScorecard",
      9,
    ),
    achievement(
      "no_doubles_nine",
      "No Doubles Nine",
      "Play 9 holes with no double bogeys.",
      "scoring",
      "gold",
      "roundScorecard",
      9,
    ),
    achievement(
      "no_doubles_round",
      "No Doubles Round",
      "Play 18 holes with no double bogeys.",
      "scoring",
      "platinum",
      "roundScorecard",
      18,
    ),
    achievement(
      "clean_card",
      "Clean Card",
      "Complete 18 holes with no triples or worse.",
      "scoring",
      "platinum",
      "roundScorecard",
      18,
    ),
    achievement(
      "hot_finish",
      "Hot Finish",
      "Play the final 3 holes +1 or better.",
      "scoring",
      "gold",
      "roundScorecard",
      3,
    ),
    achievement(
      "birdie_hunter",
      "Birdie Hunter",
      "Make a birdie.",
      "scoring",
      "silver",
      "roundScorecard",
      1,
    ),
    achievement(
      "two_birdie_round",
      "Two Birdie Round",
      "Make 2 birdies in one round.",
      "scoring",
      "platinum",
      "roundScorecard",
      2,
    ),
    achievement(
      "eagle_landed",
      "Eagle Landed",
      "Make an eagle or better.",
      "scoring",
      "diamond",
      "roundScorecard",
      1,
    ),
    achievement(
      "bounce_back",
      "Bounce Back",
      "Make par or better after a double bogey or worse.",
      "scoring",
      "gold",
      "roundScorecard",
      1,
    ),
    achievement(
      "course_champion",
      "Course Champion",
      "Hold a verified course record.",
      "scoring",
      "gold",
      "roundScorecard",
      1,
      250,
    ),
    achievement(
      "first_verified_record",
      "First Verified Record",
      "Submit your first verified course record.",
      "data",
      "silver",
      "roundScorecard",
      1,
      150,
    ),
    achievement(
      "beat_friend_record",
      "Beat a Friend Record",
      "Move ahead of a friend on a course record board.",
      "scoring",
      "gold",
      "roundScorecard",
      1,
      200,
    ),
    achievement(
      "defended_champion",
      "Defended Champion",
      "Defend a course champion record with a new verified attempt.",
      "scoring",
      "platinum",
      "roundScorecard",
      1,
      300,
    ),
    achievement(
      "major_contender",
      "Major Contender",
      "Enter a major-style tournament.",
      "scoring",
      "silver",
      "roundScorecard",
      1,
      150,
    ),
    achievement(
      "four_round_finisher",
      "Four-Round Finisher",
      "Complete all four rounds of a major-style event.",
      "scoring",
      "platinum",
      "roundScorecard",
      4,
      350,
    ),

    achievement(
      "first_one_putt",
      "First One-Putt",
      "Record a one-putt.",
      "putting",
      "bronze",
      "roundScorecard",
      1,
    ),
    achievement(
      "no_3_putt_nine",
      "No 3-Putt Nine",
      "Complete 9 holes with no 3-putts.",
      "putting",
      "silver",
      "roundScorecard",
      9,
    ),
    achievement(
      "no_3_putt_round",
      "No 3-Putt Round",
      "Complete 18 holes with no 3-putts.",
      "putting",
      "gold",
      "roundScorecard",
      18,
    ),
    achievement(
      "fifteen_putt_nine",
      "15-Putt Nine",
      "Record 15 putts or fewer over 9 holes.",
      "putting",
      "gold",
      "roundScorecard",
      15,
    ),
    achievement(
      "thirty_putt_round",
      "30-Putt Round",
      "Record 30 putts or fewer over 18 holes.",
      "putting",
      "platinum",
      "roundScorecard",
      30,
    ),
    achievement(
      "flatstick_god_mode",
      "Flatstick God Mode",
      "Record 27 putts or fewer over 18 holes.",
      "putting",
      "diamond",
      "roundScorecard",
      27,
    ),
    achievement(
      "clutch_finish",
      "Clutch Finish",
      "One-putt hole 18.",
      "putting",
      "platinum",
      "roundScorecard",
      1,
    ),

    achievement(
      "fairway_starter",
      "Fairway Starter",
      "Hit 4 fairways in a round.",
      "roundStats",
      "bronze",
      "roundScorecard",
      4,
    ),
    achievement(
      "fairway_finder_round",
      "Fairway Finder",
      "Hit 7 fairways in a round.",
      "roundStats",
      "silver",
      "roundScorecard",
      7,
    ),
    achievement(
      "driver_trust",
      "Driver Trust",
      "Hit 40%+ fairways in a round.",
      "roundStats",
      "gold",
      "roundScorecard",
      40,
    ),
    achievement(
      "tee_box_control",
      "Tee Box Control",
      "Hit 50%+ fairways in a round.",
      "roundStats",
      "platinum",
      "roundScorecard",
      50,
    ),
    achievement(
      "gir_starter",
      "GIR Starter",
      "Hit 4 greens in regulation in a round.",
      "roundStats",
      "silver",
      "roundScorecard",
      4,
    ),
    achievement(
      "gir_machine",
      "GIR Machine",
      "Hit 8 greens in regulation in a round.",
      "roundStats",
      "gold",
      "roundScorecard",
      8,
    ),
    achievement(
      "ball_striking_day",
      "Ball-Striking Day",
      "Hit 10+ greens in regulation.",
      "roundStats",
      "platinum",
      "roundScorecard",
      10,
    ),
    achievement(
      "ball_striker_mode",
      "Ball-Striker Mode",
      "Hit GIR on 50%+ of completed holes.",
      "roundStats",
      "diamond",
      "roundScorecard",
      50,
    ),
    achievement(
      "scramble_upgrade",
      "Scramble Upgrade",
      "Scramble at 20%+ in a round.",
      "shortGame",
      "gold",
      "roundScorecard",
      20,
    ),
    achievement(
      "short_game_sharp",
      "Short Game Sharp",
      "Scramble at 35%+ in a round.",
      "shortGame",
      "platinum",
      "roundScorecard",
      35,
    ),
    achievement(
      "penalty_free",
      "Penalty-Free",
      "Complete a full round with zero penalties.",
      "roundStats",
      "gold",
      "roundScorecard",
      18,
    ),

    achievement(
      "sw_dialled_50",
      "50-Yard Dialled",
      "Hit 5 SW shots between 45 and 55 yd carry in one session.",
      "shortGame",
      "silver",
      "session",
      5,
      undefined,
      ["sw"],
    ),
    achievement(
      "sw_dialled_70",
      "70-Yard Dialled",
      "Hit 5 SW shots between 65 and 75 yd carry in one session.",
      "shortGame",
      "silver",
      "session",
      5,
      undefined,
      ["sw"],
    ),
    achievement(
      "sw_wedge_ladder_i",
      "Wedge Ladder I",
      "Record SW shots in the 30, 50, and 70 yd windows in one session.",
      "shortGame",
      "gold",
      "session",
      3,
      undefined,
      ["sw"],
    ),
    achievement(
      "lw_30_yard_touch",
      "30-Yard Touch",
      "Hit 5 LW shots between 25 and 35 yd carry in one session.",
      "shortGame",
      "silver",
      "session",
      5,
      undefined,
      ["lw"],
    ),
    achievement(
      "lw_40_yard_touch",
      "40-Yard Touch",
      "Hit 5 LW shots between 35 and 45 yd carry in one session.",
      "shortGame",
      "silver",
      "session",
      5,
      undefined,
      ["lw"],
    ),
    achievement(
      "lw_lob_ladder",
      "Lob Ladder",
      "Record LW shots in the 20, 30, 40, and 50 yd windows in one session.",
      "shortGame",
      "gold",
      "session",
      4,
      undefined,
      ["lw"],
    ),
    achievement(
      "bunker_tool",
      "Bunker Tool",
      "Record a greenside sand shot.",
      "shortGame",
      "bronze",
      "roundScorecard",
      1,
    ),
    achievement(
      "sand_save",
      "Sand Save",
      "Record a greenside sand shot followed by one putt or better.",
      "shortGame",
      "gold",
      "roundScorecard",
      1,
    ),
    achievement(
      "up_and_down",
      "Up-and-Down",
      "Miss the green in regulation, then save par or better with one putt.",
      "shortGame",
      "gold",
      "roundScorecard",
      1,
    ),
    achievement(
      "scramble_day",
      "Scramble Day",
      "Record 3 successful scrambles in a round.",
      "shortGame",
      "platinum",
      "roundScorecard",
      3,
    ),

    achievement(
      "worm_burner",
      "Worm Burner",
      "Driver or 5W launch under 5 deg.",
      "hidden",
      "hidden",
      "singleShot",
      5,
      25,
    ),
    achievement(
      "moon_ball",
      "Moon Ball",
      "Driver launch over 22 deg.",
      "hidden",
      "hidden",
      "singleShot",
      22,
      25,
    ),
    achievement(
      "floor_is_lava",
      "The Floor Is Lava",
      "Shot apex under 15 ft.",
      "hidden",
      "hidden",
      "singleShot",
      15,
      25,
    ),
    achievement(
      "was_that_practice",
      "That Wasn't a Practice Swing?",
      "Carry under 10 yd with a full-shot club.",
      "hidden",
      "hidden",
      "singleShot",
      10,
      25,
    ),
    achievement(
      "absolute_rocket",
      "Absolute Rocket",
      "Set a ball-speed personal best.",
      "hidden",
      "hidden",
      "singleShot",
      undefined,
      100,
    ),
    achievement(
      "satellite_launch",
      "Satellite Launch",
      "Set an apex personal best.",
      "hidden",
      "hidden",
      "singleShot",
      undefined,
      100,
    ),
    achievement(
      "left_field",
      "Left Field",
      "Finish more than 40 yd left.",
      "hidden",
      "hidden",
      "singleShot",
      40,
      25,
    ),
    achievement(
      "right_field",
      "Right Field",
      "Finish more than 40 yd right.",
      "hidden",
      "hidden",
      "singleShot",
      40,
      25,
    ),
    achievement(
      "boomerang",
      "Boomerang",
      "Curve more than 30 yd but finish within 10 yd.",
      "hidden",
      "hidden",
      "singleShot",
      30,
    ),
    achievement(
      "efficient_but_ugly",
      "Efficient But Ugly",
      "Good smash factor, terrible offline result.",
      "hidden",
      "hidden",
      "singleShot",
      undefined,
    ),
    achievement(
      "delete_this_one",
      "Delete This One",
      "Record the worst shot of a session.",
      "hidden",
      "hidden",
      "session",
      undefined,
      25,
    ),
    achievement(
      "highlight_reel",
      "One for the Highlight Reel",
      "Record the best combined distance and accuracy shot of a session.",
      "hidden",
      "hidden",
      "session",
      undefined,
      150,
    ),
  ] satisfies Achievement[]
).map(withInferredClubTypes);

export type GeneratedClubMetric = "offlineYd" | "carryYd" | "totalYd";

export type GeneratedClubMetricAchievement = {
  id: string;
  clubType: string;
  metric: GeneratedClubMetric;
  threshold: number;
  operator: ">=" | "<=";
};

export type GeneratedClubVolumeAchievement = {
  id: string;
  clubType: string;
  shotCount: number;
};

export type GeneratedClubSessionVolumeAchievement = {
  id: string;
  clubType: string;
  shotCount: number;
  tier: AchievementTier;
};

export type GeneratedClubMileageAchievement = {
  id: string;
  clubType: string;
  miles: number;
  targetYards: number;
};

export type GeneratedClubPersonalBestMetric = "carryYd" | "totalYd" | "withControl";

export type GeneratedClubPersonalBestAchievement = {
  id: string;
  clubType: string;
  metric: GeneratedClubPersonalBestMetric;
};

export type GeneratedClubMasteryMetric =
  | "carrySpreadYd"
  | "totalSpreadYd"
  | "offlineAverageYd"
  | "launchSpreadDeg"
  | "smashAverage";

export type GeneratedClubMasteryAchievement = {
  id: string;
  clubType: string;
  metric: GeneratedClubMasteryMetric;
  threshold: number;
  operator: ">=" | "<=";
  minShots: number;
};

export type GeneratedClubBenchmarkAchievement = {
  id: string;
  clubType: string;
  levelKey: ClubBenchmarkLevelKey;
  levelLabel: string;
  targetYards: number;
};

export type GeneratedHiddenShotKind =
  | "offlineLeftYd"
  | "offlineRightYd"
  | "lowCarryYd"
  | "lowLaunchDeg"
  | "highLaunchDeg"
  | "lowApexFt"
  | "highApexFt"
  | "straightOfflineYd"
  | "pureWild";

export type GeneratedHiddenShotAchievement = {
  id: string;
  clubType: string;
  kind: GeneratedHiddenShotKind;
  threshold: number;
};

const GENERATED_CLUBS = [
  "driver",
  "3w",
  "5w",
  "7w",
  "3h",
  "4h",
  "5h",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "pw",
  "gw",
  "sw",
  "lw",
];

const GENERATED_HIDDEN_SHOT_CLUBS = [...new Set([...GENERATED_CLUBS, "2i", "3i"])];
const GENERATED_FULL_SHOT_CLUBS = GENERATED_CLUBS.filter(
  (clubType) => !["sw", "lw"].includes(clubType),
);
const GENERATED_HIDDEN_FULL_SHOT_CLUBS = GENERATED_HIDDEN_SHOT_CLUBS.filter(
  (clubType) => !["sw", "lw"].includes(clubType),
);
const GENERATED_BENCHMARK_CLUBS = [
  "driver",
  "3w",
  "5w",
  "3h",
  "4h",
  "5h",
  "2i",
  "3i",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "pw",
  "gw",
];
const GENERATED_VOLUME_CLUBS = GENERATED_CLUBS;
const GENERATED_MILEAGE_CLUBS = GENERATED_CLUBS;
export const YARDS_PER_MILE = 1760;

type GeneratedClubMetricConfig = Record<string, Partial<Record<GeneratedClubMetric, number[]>>>;

const GENERATED_CLUB_METRIC_CONFIG: GeneratedClubMetricConfig = {
  driver: {
    offlineYd: [30, 25, 20, 15, 10, 5],
    carryYd: range(150, 260, 5),
    totalYd: range(170, 300, 5),
  },
  "3w": {
    offlineYd: [25, 20, 15, 10, 7, 5],
    carryYd: range(130, 240, 5),
    totalYd: range(150, 270, 5),
  },
  "5w": {
    offlineYd: [25, 20, 15, 10, 7, 5],
    carryYd: range(120, 220, 5),
    totalYd: range(140, 250, 5),
  },
  "7w": {
    offlineYd: [25, 20, 15, 10, 7, 5],
    carryYd: range(110, 210, 5),
    totalYd: range(130, 235, 5),
  },
  "3h": {
    offlineYd: [25, 20, 15, 10, 7, 5],
    carryYd: range(110, 220, 5),
    totalYd: range(130, 245, 5),
  },
  "4h": {
    offlineYd: [25, 20, 15, 10, 7, 5],
    carryYd: range(100, 210, 5),
    totalYd: range(120, 235, 5),
  },
  "5h": {
    offlineYd: [25, 20, 15, 10, 7, 5],
    carryYd: range(90, 200, 5),
    totalYd: range(110, 225, 5),
  },
  "4i": {
    offlineYd: [25, 20, 15, 10, 7, 5],
    carryYd: range(90, 210, 5),
    totalYd: range(105, 225, 5),
  },
  "5i": {
    offlineYd: [25, 20, 15, 10, 7, 5],
    carryYd: range(80, 200, 5),
    totalYd: range(95, 215, 5),
  },
  "6i": {
    offlineYd: [25, 20, 15, 10, 7, 5],
    carryYd: range(70, 190, 5),
    totalYd: range(85, 205, 5),
  },
  "7i": {
    offlineYd: [20, 15, 12, 10, 7, 5],
    carryYd: range(60, 180, 5),
    totalYd: range(75, 195, 5),
  },
  "8i": {
    offlineYd: [20, 15, 12, 10, 7, 5],
    carryYd: range(50, 170, 5),
    totalYd: range(65, 185, 5),
  },
  "9i": {
    offlineYd: [20, 15, 12, 10, 7, 5],
    carryYd: range(40, 160, 5),
    totalYd: range(55, 175, 5),
  },
  pw: { offlineYd: [15, 12, 10, 7, 5], carryYd: range(30, 150, 5), totalYd: range(40, 165, 5) },
  gw: { offlineYd: [15, 12, 10, 7, 5], carryYd: range(20, 135, 5), totalYd: range(30, 150, 5) },
  sw: { carryYd: range(10, 110, 5), totalYd: range(15, 120, 5) },
  lw: { carryYd: range(5, 90, 5), totalYd: range(10, 100, 5) },
};

const GENERATED_VOLUME_SHOT_COUNTS = [1, 5, 10, 15, 25, 35, 50, 100];
const GENERATED_SESSION_VOLUME_SHOT_COUNTS: Array<{ shotCount: number; tier: AchievementTier }> = [
  { shotCount: 5, tier: "bronze" },
  { shotCount: 8, tier: "bronze" },
  { shotCount: 10, tier: "silver" },
  { shotCount: 15, tier: "silver" },
  { shotCount: 20, tier: "gold" },
  { shotCount: 30, tier: "gold" },
  { shotCount: 40, tier: "gold" },
];
const GENERATED_MILEAGE_MILESTONES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 50, 100];
const GENERATED_MASTERY_SAMPLE_CLUBS = GENERATED_FULL_SHOT_CLUBS;
const GENERATED_MASTERY_MIN_SHOTS = 10;
const HIDDEN_OFFLINE_THRESHOLDS = [20, 35, 50, 70];
const HIDDEN_LAUNCH_LOW_THRESHOLDS = [4, 7];
const HIDDEN_LAUNCH_HIGH_THRESHOLDS = [24, 30];
const HIDDEN_APEX_LOW_THRESHOLDS = [20, 35];
const HIDDEN_APEX_HIGH_THRESHOLDS = [130, 170];
const HIDDEN_LOW_CARRY_RATIOS = [0.25, 0.5, 0.75];
const HIDDEN_STRAIGHT_OFFLINE_THRESHOLD = 2;
const HIDDEN_PURE_WILD_OFFLINE_THRESHOLD = 35;

export const GENERATED_CLUB_METRIC_ACHIEVEMENTS = buildGeneratedClubMetricAchievements();
export const GENERATED_CLUB_METRICS_BY_CLUB = new Map<string, GeneratedClubMetricAchievement[]>();
export const GENERATED_CLUB_VOLUME_ACHIEVEMENTS = buildGeneratedClubVolumeAchievements();
export const GENERATED_CLUB_VOLUME_BY_CLUB = new Map<string, GeneratedClubVolumeAchievement[]>();
export const GENERATED_CLUB_SESSION_VOLUME_ACHIEVEMENTS =
  buildGeneratedClubSessionVolumeAchievements();
export const GENERATED_CLUB_SESSION_VOLUME_BY_CLUB = new Map<
  string,
  GeneratedClubSessionVolumeAchievement[]
>();
export const GENERATED_CLUB_MILEAGE_ACHIEVEMENTS = buildGeneratedClubMileageAchievements();
export const GENERATED_CLUB_MILEAGE_BY_CLUB = new Map<string, GeneratedClubMileageAchievement[]>();
export const GENERATED_CLUB_PERSONAL_BEST_ACHIEVEMENTS =
  buildGeneratedClubPersonalBestAchievements();
export const GENERATED_CLUB_PERSONAL_BEST_BY_CLUB = new Map<
  string,
  GeneratedClubPersonalBestAchievement[]
>();
export const GENERATED_CLUB_MASTERY_ACHIEVEMENTS = buildGeneratedClubMasteryAchievements();
export const GENERATED_CLUB_MASTERY_BY_CLUB = new Map<string, GeneratedClubMasteryAchievement[]>();
export const GENERATED_CLUB_BENCHMARK_ACHIEVEMENTS = buildGeneratedClubBenchmarkAchievements();
export const GENERATED_CLUB_BENCHMARKS_BY_CLUB = new Map<
  string,
  GeneratedClubBenchmarkAchievement[]
>();
export const GENERATED_HIDDEN_SHOT_ACHIEVEMENTS = buildGeneratedHiddenShotAchievements();
export const GENERATED_HIDDEN_SHOTS_BY_CLUB = new Map<string, GeneratedHiddenShotAchievement[]>();

for (const generated of GENERATED_CLUB_METRIC_ACHIEVEMENTS) {
  const existing = GENERATED_CLUB_METRICS_BY_CLUB.get(generated.clubType) ?? [];
  existing.push(generated);
  GENERATED_CLUB_METRICS_BY_CLUB.set(generated.clubType, existing);
}

for (const generated of GENERATED_CLUB_VOLUME_ACHIEVEMENTS) {
  const existing = GENERATED_CLUB_VOLUME_BY_CLUB.get(generated.clubType) ?? [];
  existing.push(generated);
  GENERATED_CLUB_VOLUME_BY_CLUB.set(generated.clubType, existing);
}

for (const generated of GENERATED_CLUB_SESSION_VOLUME_ACHIEVEMENTS) {
  const existing = GENERATED_CLUB_SESSION_VOLUME_BY_CLUB.get(generated.clubType) ?? [];
  existing.push(generated);
  GENERATED_CLUB_SESSION_VOLUME_BY_CLUB.set(generated.clubType, existing);
}

for (const generated of GENERATED_CLUB_MILEAGE_ACHIEVEMENTS) {
  const existing = GENERATED_CLUB_MILEAGE_BY_CLUB.get(generated.clubType) ?? [];
  existing.push(generated);
  GENERATED_CLUB_MILEAGE_BY_CLUB.set(generated.clubType, existing);
}

for (const generated of GENERATED_CLUB_PERSONAL_BEST_ACHIEVEMENTS) {
  const existing = GENERATED_CLUB_PERSONAL_BEST_BY_CLUB.get(generated.clubType) ?? [];
  existing.push(generated);
  GENERATED_CLUB_PERSONAL_BEST_BY_CLUB.set(generated.clubType, existing);
}

for (const generated of GENERATED_CLUB_MASTERY_ACHIEVEMENTS) {
  const existing = GENERATED_CLUB_MASTERY_BY_CLUB.get(generated.clubType) ?? [];
  existing.push(generated);
  GENERATED_CLUB_MASTERY_BY_CLUB.set(generated.clubType, existing);
}

for (const generated of GENERATED_CLUB_BENCHMARK_ACHIEVEMENTS) {
  const existing = GENERATED_CLUB_BENCHMARKS_BY_CLUB.get(generated.clubType) ?? [];
  existing.push(generated);
  GENERATED_CLUB_BENCHMARKS_BY_CLUB.set(generated.clubType, existing);
}

for (const generated of GENERATED_HIDDEN_SHOT_ACHIEVEMENTS) {
  const existing = GENERATED_HIDDEN_SHOTS_BY_CLUB.get(generated.clubType) ?? [];
  existing.push(generated);
  GENERATED_HIDDEN_SHOTS_BY_CLUB.set(generated.clubType, existing);
}

export const ACHIEVEMENTS: Achievement[] = [
  ...CORE_ACHIEVEMENTS,
  ...GENERATED_CLUB_METRIC_ACHIEVEMENTS.map(toGeneratedAchievement),
  ...GENERATED_CLUB_VOLUME_ACHIEVEMENTS.map(toGeneratedVolumeAchievement),
  ...GENERATED_CLUB_SESSION_VOLUME_ACHIEVEMENTS.map(toGeneratedSessionVolumeAchievement),
  ...GENERATED_CLUB_MILEAGE_ACHIEVEMENTS.map(toGeneratedMileageAchievement),
  ...GENERATED_CLUB_PERSONAL_BEST_ACHIEVEMENTS.map(toGeneratedPersonalBestAchievement),
  ...GENERATED_CLUB_MASTERY_ACHIEVEMENTS.map(toGeneratedMasteryAchievement),
  ...GENERATED_CLUB_BENCHMARK_ACHIEVEMENTS.map(toGeneratedBenchmarkAchievement),
  ...GENERATED_HIDDEN_SHOT_ACHIEVEMENTS.map(toGeneratedHiddenShotAchievement),
];

export type AchievementId = string;

export const ACHIEVEMENT_BY_ID = new Map<string, Achievement>(
  ACHIEVEMENTS.map((achievementEntry) => [achievementEntry.id, achievementEntry]),
);

export function getAchievement(achievementId: string) {
  return ACHIEVEMENT_BY_ID.get(achievementId) ?? null;
}

function buildGeneratedClubMetricAchievements(): GeneratedClubMetricAchievement[] {
  const generated: GeneratedClubMetricAchievement[] = [];

  for (const [clubType, metricConfig] of Object.entries(GENERATED_CLUB_METRIC_CONFIG)) {
    for (const threshold of metricConfig.carryYd ?? []) {
      generated.push({
        id: generatedClubMetricId(clubType, "carryYd", threshold),
        clubType,
        metric: "carryYd",
        threshold,
        operator: ">=",
      });
    }

    for (const threshold of metricConfig.totalYd ?? []) {
      generated.push({
        id: generatedClubMetricId(clubType, "totalYd", threshold),
        clubType,
        metric: "totalYd",
        threshold,
        operator: ">=",
      });
    }

    for (const threshold of metricConfig.offlineYd ?? []) {
      generated.push({
        id: generatedClubMetricId(clubType, "offlineYd", threshold),
        clubType,
        metric: "offlineYd",
        threshold,
        operator: "<=",
      });
    }
  }

  return generated;
}

function buildGeneratedClubVolumeAchievements(): GeneratedClubVolumeAchievement[] {
  const generated: GeneratedClubVolumeAchievement[] = [];

  for (const clubType of GENERATED_VOLUME_CLUBS) {
    for (const shotCount of GENERATED_VOLUME_SHOT_COUNTS) {
      generated.push({
        id: `club_${clubType}_volume_${shotCount}`,
        clubType,
        shotCount,
      });
    }
  }

  return generated;
}

function buildGeneratedClubSessionVolumeAchievements(): GeneratedClubSessionVolumeAchievement[] {
  const generated: GeneratedClubSessionVolumeAchievement[] = [];

  for (const clubType of GENERATED_VOLUME_CLUBS) {
    for (const { shotCount, tier } of GENERATED_SESSION_VOLUME_SHOT_COUNTS) {
      generated.push({
        id: `club_${clubType}_session_${shotCount}`,
        clubType,
        shotCount,
        tier,
      });
    }
  }

  return generated;
}

function buildGeneratedClubMileageAchievements(): GeneratedClubMileageAchievement[] {
  const generated: GeneratedClubMileageAchievement[] = [];

  for (const clubType of GENERATED_MILEAGE_CLUBS) {
    for (const miles of GENERATED_MILEAGE_MILESTONES) {
      generated.push({
        id: `club_${clubType}_miles_${miles}`,
        clubType,
        miles,
        targetYards: miles * YARDS_PER_MILE,
      });
    }
  }

  return generated;
}

function buildGeneratedClubPersonalBestAchievements(): GeneratedClubPersonalBestAchievement[] {
  const generated: GeneratedClubPersonalBestAchievement[] = [];

  for (const clubType of GENERATED_FULL_SHOT_CLUBS) {
    for (const metric of [
      "carryYd",
      "totalYd",
      "withControl",
    ] satisfies GeneratedClubPersonalBestMetric[]) {
      generated.push({
        id: `club_${clubType}_pb_${personalBestMetricId(metric)}`,
        clubType,
        metric,
      });
    }
  }

  return generated;
}

function buildGeneratedClubMasteryAchievements(): GeneratedClubMasteryAchievement[] {
  const generated: GeneratedClubMasteryAchievement[] = [];
  const configs: Array<{
    metric: GeneratedClubMasteryMetric;
    thresholds: number[];
    operator: ">=" | "<=";
  }> = [
    {
      metric: "carrySpreadYd",
      thresholds: [45, 40, 35, 30, 25, 22, 20, 18, 15, 12],
      operator: "<=",
    },
    {
      metric: "totalSpreadYd",
      thresholds: [60, 55, 50, 45, 40, 35, 30, 25, 20, 15],
      operator: "<=",
    },
    {
      metric: "offlineAverageYd",
      thresholds: [30, 25, 20, 18, 15, 12, 10, 8, 6, 5],
      operator: "<=",
    },
    { metric: "launchSpreadDeg", thresholds: [10, 9, 8, 7, 6, 5, 4, 3.5, 3, 2.5], operator: "<=" },
    { metric: "smashAverage", thresholds: [], operator: ">=" },
  ];

  for (const clubType of GENERATED_MASTERY_SAMPLE_CLUBS) {
    for (const config of configs) {
      const thresholds =
        config.metric === "smashAverage"
          ? smashAverageThresholdsForClub(clubType)
          : config.thresholds;

      for (const threshold of thresholds) {
        generated.push({
          id: `club_${clubType}_mastery_${masteryMetricId(config.metric)}_${thresholdId(threshold)}`,
          clubType,
          metric: config.metric,
          threshold,
          operator: config.operator,
          minShots: GENERATED_MASTERY_MIN_SHOTS,
        });
      }
    }
  }

  return generated;
}

function buildGeneratedClubBenchmarkAchievements(): GeneratedClubBenchmarkAchievement[] {
  const generated: GeneratedClubBenchmarkAchievement[] = [];

  for (const clubType of GENERATED_BENCHMARK_CLUBS) {
    const benchmark = getClubDistanceBenchmark(clubType);

    if (!benchmark) {
      continue;
    }

    for (const level of benchmark.levels) {
      generated.push({
        id: `club_${clubType}_benchmark_${level.key}`,
        clubType,
        levelKey: level.key,
        levelLabel: level.label,
        targetYards: level.yards,
      });
    }
  }

  return generated;
}

function buildGeneratedHiddenShotAchievements(): GeneratedHiddenShotAchievement[] {
  const generated: GeneratedHiddenShotAchievement[] = [];

  for (const clubType of GENERATED_HIDDEN_SHOT_CLUBS) {
    for (const threshold of HIDDEN_OFFLINE_THRESHOLDS) {
      generated.push(hiddenShotAchievement(clubType, "offlineLeftYd", threshold));
      generated.push(hiddenShotAchievement(clubType, "offlineRightYd", threshold));
    }

    for (const threshold of HIDDEN_APEX_LOW_THRESHOLDS) {
      generated.push(hiddenShotAchievement(clubType, "lowApexFt", threshold));
    }

    for (const threshold of HIDDEN_APEX_HIGH_THRESHOLDS) {
      generated.push(hiddenShotAchievement(clubType, "highApexFt", threshold));
    }

    generated.push(
      hiddenShotAchievement(clubType, "straightOfflineYd", HIDDEN_STRAIGHT_OFFLINE_THRESHOLD),
    );
  }

  for (const clubType of GENERATED_HIDDEN_FULL_SHOT_CLUBS) {
    for (const threshold of HIDDEN_LAUNCH_LOW_THRESHOLDS) {
      generated.push(hiddenShotAchievement(clubType, "lowLaunchDeg", threshold));
    }

    for (const threshold of HIDDEN_LAUNCH_HIGH_THRESHOLDS) {
      generated.push(hiddenShotAchievement(clubType, "highLaunchDeg", threshold));
    }

    generated.push(hiddenShotAchievement(clubType, "pureWild", HIDDEN_PURE_WILD_OFFLINE_THRESHOLD));
  }

  for (const clubType of GENERATED_BENCHMARK_CLUBS) {
    const benchmark = getClubDistanceBenchmark(clubType);
    const beginner = benchmark?.levels.find((level) => level.key === "beginner");

    if (!beginner) {
      continue;
    }

    for (const ratio of HIDDEN_LOW_CARRY_RATIOS) {
      generated.push(
        hiddenShotAchievement(clubType, "lowCarryYd", Math.round(beginner.yards * ratio)),
      );
    }
  }

  return generated;
}

function hiddenShotAchievement(
  clubType: string,
  kind: GeneratedHiddenShotKind,
  threshold: number,
): GeneratedHiddenShotAchievement {
  return {
    id: `club_${clubType}_hidden_${hiddenShotKindId(kind)}_${thresholdId(threshold)}`,
    clubType,
    kind,
    threshold,
  };
}

function toGeneratedAchievement(generated: GeneratedClubMetricAchievement): Achievement {
  const clubLabel = formatClubLabel(generated.clubType);
  const tier = tierForGeneratedAchievement(generated);

  if (generated.metric === "carryYd") {
    return achievement(
      generated.id,
      `${clubLabel} Carry ${generated.threshold}`,
      `Carry ${clubLabel} ${generated.threshold}+ yd.`,
      isShortGameGeneratedClub(generated.clubType) ? "shortGame" : "power",
      tier,
      "singleShot",
      generated.threshold,
      undefined,
      [generated.clubType],
    );
  }

  if (generated.metric === "totalYd") {
    return achievement(
      generated.id,
      `${clubLabel} Total ${generated.threshold}`,
      `Hit ${clubLabel} ${generated.threshold}+ yd total.`,
      isShortGameGeneratedClub(generated.clubType) ? "shortGame" : "power",
      tier,
      "singleShot",
      generated.threshold,
      undefined,
      [generated.clubType],
    );
  }

  return achievement(
    generated.id,
    `${clubLabel} Offline ${generated.threshold}`,
    `Finish ${clubLabel} within ${generated.threshold} yd of target.`,
    "accuracy",
    tier,
    "singleShot",
    generated.threshold,
    undefined,
    [generated.clubType],
  );
}

function toGeneratedPersonalBestAchievement(
  generated: GeneratedClubPersonalBestAchievement,
): Achievement {
  const clubLabel = formatClubLabel(generated.clubType);

  if (generated.metric === "carryYd") {
    return achievement(
      generated.id,
      `${clubLabel} Personal Best Carry`,
      `Beat your previous ${clubLabel} carry personal best.`,
      "progress",
      "gold",
      "progress",
      undefined,
      undefined,
      [generated.clubType],
    );
  }

  if (generated.metric === "totalYd") {
    return achievement(
      generated.id,
      `${clubLabel} Personal Best Total`,
      `Beat your previous ${clubLabel} total-distance personal best.`,
      "progress",
      "gold",
      "progress",
      undefined,
      undefined,
      [generated.clubType],
    );
  }

  return achievement(
    generated.id,
    `${clubLabel} PB With Control`,
    `Beat a ${clubLabel} distance personal best while finishing within 15 yd offline.`,
    "progress",
    "platinum",
    "progress",
    undefined,
    undefined,
    [generated.clubType],
  );
}

function toGeneratedMasteryAchievement(generated: GeneratedClubMasteryAchievement): Achievement {
  const clubLabel = formatClubLabel(generated.clubType);
  const tier = tierForGeneratedMasteryAchievement(generated);

  return achievement(
    generated.id,
    `${clubLabel} ${masteryMetricName(generated.metric)} ${formatMasteryThreshold(generated)}`,
    masteryDescription(clubLabel, generated),
    masteryCategory(generated.metric),
    tier,
    "session",
    generated.threshold,
    undefined,
    [generated.clubType],
  );
}

function toGeneratedBenchmarkAchievement(
  generated: GeneratedClubBenchmarkAchievement,
): Achievement {
  const clubLabel = formatClubLabel(generated.clubType);

  return achievement(
    generated.id,
    `${clubLabel} ${generated.levelLabel} Marker`,
    `Build a reliable ${clubLabel} stock carry of ${generated.targetYards}+ yd to reach the ${generated.levelLabel} benchmark.`,
    "gapping",
    tierForBenchmarkLevel(generated.levelKey),
    "stockYardage",
    generated.targetYards,
    undefined,
    [generated.clubType],
  );
}

function toGeneratedHiddenShotAchievement(generated: GeneratedHiddenShotAchievement): Achievement {
  const clubLabel = formatClubLabel(generated.clubType);

  return achievement(
    generated.id,
    hiddenShotName(clubLabel, generated),
    hiddenShotDescription(clubLabel, generated),
    "hidden",
    "hidden",
    "singleShot",
    generated.threshold,
    25,
    [generated.clubType],
  );
}

function toGeneratedVolumeAchievement(generated: GeneratedClubVolumeAchievement): Achievement {
  const clubLabel = formatClubLabel(generated.clubType);
  const tier = tierForGeneratedVolumeAchievement(generated.shotCount);

  return achievement(
    generated.id,
    `${clubLabel} ${volumeNameForShotCount(generated.shotCount)}`,
    volumeDescriptionForShotCount(clubLabel, generated.shotCount),
    isShortGameGeneratedClub(generated.clubType) ? "shortGame" : "consistency",
    tier,
    "rollingWindow",
    generated.shotCount,
    undefined,
    [generated.clubType],
  );
}

function toGeneratedSessionVolumeAchievement(
  generated: GeneratedClubSessionVolumeAchievement,
): Achievement {
  const clubLabel = formatClubLabel(generated.clubType);

  return achievement(
    generated.id,
    `${clubLabel} Session ${generated.shotCount}`,
    `Hit ${generated.shotCount}+ ${clubLabel} shots in one session.`,
    isShortGameGeneratedClub(generated.clubType) ? "shortGame" : "consistency",
    generated.tier,
    "session",
    generated.shotCount,
    undefined,
    [generated.clubType],
  );
}

function toGeneratedMileageAchievement(generated: GeneratedClubMileageAchievement): Achievement {
  const clubLabel = formatClubLabel(generated.clubType);
  const tier = tierForGeneratedMileageAchievement(generated.miles);

  return achievement(
    generated.id,
    `${clubLabel} ${mileageName(generated.miles)}`,
    `Accumulate ${generated.miles.toLocaleString("en-GB")} ${generated.miles === 1 ? "mile" : "miles"} of total distance with ${clubLabel}.`,
    "mileage",
    tier,
    "rollingWindow",
    generated.miles,
    undefined,
    [generated.clubType],
  );
}

function withInferredClubTypes(achievementEntry: Achievement): Achievement {
  const clubTypes = inferCoreClubTypes(achievementEntry.id);

  if (clubTypes.length === 0) {
    return achievementEntry;
  }

  return {
    ...achievementEntry,
    clubTypes,
  };
}

function inferCoreClubTypes(id: string) {
  if (
    id.startsWith("driver_") ||
    [
      "distance_up_5",
      "distance_up_10",
      "ball_speed_gain",
      "launch_fixed",
      "path_improved",
      "side_carry_improved",
      "hook_reduced",
      "hook_exorcist",
      "moon_ball",
    ].includes(id)
  ) {
    return ["driver"];
  }

  if (id.startsWith("fivewood_")) {
    return ["5w"];
  }

  if (id.startsWith("iron_") || id === "iron_day" || id === "iron_stocked") {
    return IRON_CLUBS;
  }

  if (id === "wedge_day") {
    return WEDGE_CLUBS;
  }

  if (id === "top_end_fixed") {
    return ["driver", "5w", "5i"];
  }

  if (id === "scoring_gap_fixed") {
    return ["pw", "9i", "8i"];
  }

  if (id === "eight_nine_gap_healthy") {
    return ["8i", "9i"];
  }

  if (id === "driver_stocked") {
    return ["driver"];
  }

  if (id === "fivewood_stocked") {
    return ["5w"];
  }

  if (id === "worm_burner") {
    return ["driver", "5w"];
  }

  return [];
}

function tierForGeneratedVolumeAchievement(shotCount: number): AchievementTier {
  if (shotCount >= 100) return "diamond";
  if (shotCount >= 50) return "platinum";
  if (shotCount >= 25) return "gold";
  if (shotCount >= 10) return "silver";
  return "bronze";
}

function tierForGeneratedMileageAchievement(miles: number): AchievementTier {
  if (miles >= 25) return "diamond";
  if (miles >= 10) return "platinum";
  if (miles >= 5) return "gold";
  if (miles >= 2) return "silver";
  return "bronze";
}

function tierForGeneratedMasteryAchievement(
  generated: GeneratedClubMasteryAchievement,
): AchievementTier {
  const thresholds =
    generated.metric === "smashAverage"
      ? smashAverageThresholdsForClub(generated.clubType)
      : generated.metric === "carrySpreadYd"
        ? [45, 40, 35, 30, 25, 22, 20, 18, 15, 12]
        : generated.metric === "totalSpreadYd"
          ? [60, 55, 50, 45, 40, 35, 30, 25, 20, 15]
          : generated.metric === "offlineAverageYd"
            ? [30, 25, 20, 18, 15, 12, 10, 8, 6, 5]
            : [10, 9, 8, 7, 6, 5, 4, 3.5, 3, 2.5];
  const index = thresholds.findIndex((threshold) => threshold === generated.threshold);
  const masteryIndex = index < 0 ? 0 : index;

  if (masteryIndex >= 8) return "diamond";
  if (masteryIndex >= 6) return "platinum";
  if (masteryIndex >= 4) return "gold";
  if (masteryIndex >= 2) return "silver";
  return "bronze";
}

function personalBestMetricId(metric: GeneratedClubPersonalBestMetric) {
  if (metric === "carryYd") return "carry";
  if (metric === "totalYd") return "total";
  return "with_control";
}

function volumeNameForShotCount(shotCount: number) {
  if (shotCount >= 100) return "Bag Veteran";
  if (shotCount >= 50) return "Trusted Club";
  if (shotCount >= 35) return "Grooved In";
  if (shotCount >= 25) return "Proper Sample";
  if (shotCount >= 15) return "Warming Up";
  if (shotCount >= 10) return "Getting Acquainted";
  if (shotCount >= 5) return "Range Intro";
  return "First Strike";
}

function volumeDescriptionForShotCount(clubLabel: string, shotCount: number) {
  if (shotCount === 1) {
    return `Log your first tracked shot with ${clubLabel}.`;
  }

  return `Log ${shotCount}+ tracked shots with ${clubLabel}.`;
}

function mileageName(miles: number) {
  if (miles === 1) {
    return "1 Mile";
  }

  return `${miles.toLocaleString("en-GB")} Miles`;
}

function isShortGameGeneratedClub(clubType: string) {
  return clubType === "sw" || clubType === "lw";
}

function tierForBenchmarkLevel(levelKey: ClubBenchmarkLevelKey): AchievementTier {
  if (levelKey === "tour") return "diamond";
  if (levelKey === "advanced") return "platinum";
  if (levelKey === "good") return "gold";
  if (levelKey === "average") return "silver";
  return "bronze";
}

function hiddenShotKindId(kind: GeneratedHiddenShotKind) {
  if (kind === "offlineLeftYd") return "left_miss";
  if (kind === "offlineRightYd") return "right_miss";
  if (kind === "lowCarryYd") return "low_carry";
  if (kind === "lowLaunchDeg") return "low_launch";
  if (kind === "highLaunchDeg") return "high_launch";
  if (kind === "lowApexFt") return "low_apex";
  if (kind === "highApexFt") return "high_apex";
  if (kind === "straightOfflineYd") return "centre_line";
  return "pure_wild";
}

function hiddenShotName(clubLabel: string, generated: GeneratedHiddenShotAchievement) {
  if (generated.kind === "offlineLeftYd") return `${clubLabel} Left Detour ${generated.threshold}`;
  if (generated.kind === "offlineRightYd")
    return `${clubLabel} Right Detour ${generated.threshold}`;
  if (generated.kind === "lowCarryYd") return `${clubLabel} False Start ${generated.threshold}`;
  if (generated.kind === "lowLaunchDeg")
    return `${clubLabel} Ground Skimmer ${generated.threshold}`;
  if (generated.kind === "highLaunchDeg")
    return `${clubLabel} Elevator Button ${generated.threshold}`;
  if (generated.kind === "lowApexFt") return `${clubLabel} Low Ceiling ${generated.threshold}`;
  if (generated.kind === "highApexFt") return `${clubLabel} Roof Test ${generated.threshold}`;
  if (generated.kind === "straightOfflineYd") return `${clubLabel} Centre Line`;
  return `${clubLabel} Pure But Gone`;
}

function hiddenShotDescription(clubLabel: string, generated: GeneratedHiddenShotAchievement) {
  if (generated.kind === "offlineLeftYd") {
    return `Finish a tracked ${clubLabel} shot ${generated.threshold}+ yd left.`;
  }

  if (generated.kind === "offlineRightYd") {
    return `Finish a tracked ${clubLabel} shot ${generated.threshold}+ yd right.`;
  }

  if (generated.kind === "lowCarryYd") {
    return `Carry ${clubLabel} ${generated.threshold} yd or less on a tracked full shot.`;
  }

  if (generated.kind === "lowLaunchDeg") {
    return `Launch ${clubLabel} under ${generated.threshold} deg.`;
  }

  if (generated.kind === "highLaunchDeg") {
    return `Launch ${clubLabel} over ${generated.threshold} deg.`;
  }

  if (generated.kind === "lowApexFt") {
    return `Keep a tracked ${clubLabel} shot under ${generated.threshold} ft apex.`;
  }

  if (generated.kind === "highApexFt") {
    return `Send a tracked ${clubLabel} shot over ${generated.threshold} ft apex.`;
  }

  if (generated.kind === "straightOfflineYd") {
    return `Finish a tracked ${clubLabel} shot within ${generated.threshold} yd of the target line.`;
  }

  return `Record solid smash with ${clubLabel} but finish ${generated.threshold}+ yd offline.`;
}

function masteryMetricId(metric: GeneratedClubMasteryMetric) {
  if (metric === "carrySpreadYd") return "carry_spread";
  if (metric === "totalSpreadYd") return "total_spread";
  if (metric === "offlineAverageYd") return "offline_average";
  if (metric === "launchSpreadDeg") return "launch_spread";
  return "smash_average";
}

function masteryMetricName(metric: GeneratedClubMasteryMetric) {
  if (metric === "carrySpreadYd") return "Carry Pattern";
  if (metric === "totalSpreadYd") return "Total Pattern";
  if (metric === "offlineAverageYd") return "Line Control";
  if (metric === "launchSpreadDeg") return "Launch Pattern";
  return "Strike Pattern";
}

function masteryDescription(clubLabel: string, generated: GeneratedClubMasteryAchievement) {
  const sample = `${generated.minShots} ${clubLabel} shots in one session`;

  if (generated.metric === "carrySpreadYd") {
    return `Keep ${sample} inside a ${generated.threshold} yd carry spread.`;
  }

  if (generated.metric === "totalSpreadYd") {
    return `Keep ${sample} inside a ${generated.threshold} yd total spread.`;
  }

  if (generated.metric === "offlineAverageYd") {
    return `Average ${generated.threshold} yd offline or better over ${sample}.`;
  }

  if (generated.metric === "launchSpreadDeg") {
    return `Keep ${sample} inside a ${generated.threshold} deg launch spread.`;
  }

  return `Average ${generated.threshold.toFixed(2)}+ smash factor over ${sample}.`;
}

function masteryCategory(metric: GeneratedClubMasteryMetric): AchievementCategory {
  if (metric === "offlineAverageYd") return "accuracy";
  if (metric === "launchSpreadDeg") return "launch";
  if (metric === "smashAverage") return "strike";
  return "consistency";
}

function formatMasteryThreshold(generated: GeneratedClubMasteryAchievement) {
  if (generated.metric === "smashAverage") {
    return generated.threshold.toFixed(2);
  }

  if (generated.metric === "launchSpreadDeg") {
    return `${generated.threshold}deg`;
  }

  return `${generated.threshold}yd`;
}

function thresholdId(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toString().replace(".", "");
}

function smashAverageThresholdsForClub(clubType: string) {
  if (clubType === "driver" || ["3w", "5w", "7w"].includes(clubType)) {
    return decimalRange(1.3, 1.48, 0.02);
  }

  if (clubType.endsWith("h") || clubType.endsWith("i")) {
    return decimalRange(1.12, 1.39, 0.03);
  }

  return decimalRange(1.02, 1.29, 0.03);
}

function generatedClubMetricId(clubType: string, metric: GeneratedClubMetric, threshold: number) {
  if (metric === "offlineYd") {
    return `club_${clubType}_offline_${threshold}`;
  }

  if (metric === "carryYd") {
    return `club_${clubType}_carry_${threshold}`;
  }

  return `club_${clubType}_total_${threshold}`;
}

function tierForGeneratedAchievement(generated: GeneratedClubMetricAchievement): AchievementTier {
  if (generated.metric === "offlineYd") {
    if (generated.threshold <= 3) return "diamond";
    if (generated.threshold <= 5) return "platinum";
    if (generated.threshold <= 10) return "gold";
    if (generated.threshold <= 20) return "silver";
    return "bronze";
  }

  const thresholds = GENERATED_CLUB_METRIC_CONFIG[generated.clubType]?.[generated.metric] ?? [];
  const index = thresholds.findIndex((threshold) => threshold === generated.threshold);
  const ratio = index < 0 || thresholds.length === 0 ? 0 : (index + 1) / thresholds.length;

  if (ratio >= 0.9) return "diamond";
  if (ratio >= 0.75) return "platinum";
  if (ratio >= 0.55) return "gold";
  if (ratio >= 0.3) return "silver";
  return "bronze";
}

function formatClubLabel(clubType: string) {
  if (clubType === "driver") {
    return "Driver";
  }

  if (/^[1-9][wh]$/.test(clubType)) {
    return clubType.toUpperCase();
  }

  if (/^[1-9]i$/.test(clubType)) {
    return `${clubType[0]}i`;
  }

  return clubType.toUpperCase();
}

function decimalRange(start: number, end: number, step: number) {
  const values: number[] = [];

  for (let value = start; value <= end + step / 2; value += step) {
    values.push(Math.round(value * 100) / 100);
  }

  return values;
}

function range(start: number, end: number, step: number) {
  const values: number[] = [];

  for (let value = start; value <= end; value += step) {
    values.push(value);
  }

  return values;
}
