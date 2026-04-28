export interface Student {
  id: number;
  name: string;
  is_joined: boolean;
  bond_level: number | null;
  wb_hp: number | null;
  wb_atk: number | null;
  wb_heal: number | null;
  skill_ex: number | null;
  skill_normal: number | null;
  skill_passive: number | null;
  skill_sub: number | null;
  limit_break: number | null;
  equip1: number | null;
  equip2: number | null;
  equip3: number | null;
  updated_at: string | null;
  limit_break_display: string | null;
  skill_ex_display: string | null;
  skill_normal_display: string | null;
  skill_passive_display: string | null;
  skill_sub_display: string | null;
}

export interface CaptureResult {
  detected: boolean;
  name: string | null;
  bond_level: number | null;
  wb_hp: number | null;
  wb_atk: number | null;
  wb_heal: number | null;
  skill_ex: number | null;
  skill_normal: number | null;
  skill_passive: number | null;
  skill_sub: number | null;
  limit_break: number | null;
  equip1: number | null;
  equip2: number | null;
  equip3: number | null;
}

export interface StudentUpdate {
  bond_level?: number | null;
  wb_hp?: number | null;
  wb_atk?: number | null;
  wb_heal?: number | null;
  skill_ex?: number | null;
  skill_normal?: number | null;
  skill_passive?: number | null;
  skill_sub?: number | null;
  limit_break?: number | null;
  equip1?: number | null;
  equip2?: number | null;
  equip3?: number | null;
}

export interface FilterState {
  name: string;
  join: "all" | "joined" | "not_joined";
}
