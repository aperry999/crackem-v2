import type { GroupFit } from './api';
import { clock } from './format';

const yes = (gf: GroupFit, k: keyof GroupFit) => gf[k]?.value === 'yes';

/** Short drink labels for people who don't drink beer, in the doc's order. */
export function drinkBadges(gf: GroupFit) {
  const out: string[] = [];
  if (yes(gf, 'cocktails')) {
    const t = gf.cocktails?.types?.filter((x) => x !== 'type_unclear') ?? [];
    out.push(t.length ? `Cocktails (${t.map((x) => x.replace('_', '-')).join(', ')})` : 'Cocktails');
  }
  if (yes(gf, 'wine')) out.push('Wine');
  if (yes(gf, 'cider')) out.push('Cider');
  if (yes(gf, 'seltzer')) out.push('Seltzer');
  if (yes(gf, 'na_beer')) out.push('NA beer');
  if (yes(gf, 'mocktails')) out.push('Mocktails');
  if (yes(gf, 'low_abv')) out.push('Low-ABV');
  return out;
}

export type FoodTonight = { title: string; starts_at: string | null; ends_at: string | null } | null;

/** A food post is a truck unless the title reads like a deal or a dish night ("$1 Wing Wednesday"). */
export function isTruck(title: string) {
  if (/truck|trailer|\bcart\b/i.test(title)) return true;
  return !/special|wings?\b|\$|bogo|brunch|pairing|deal|half off|% off|happy hour|\bnight\b|\bnite\b|day\b|menu|pie\b/i.test(title);
}

const spanLabel = (f: NonNullable<FoodTonight>, now: Date) => {
  if (f.starts_at && new Date(f.starts_at) > now) {
    return f.ends_at ? `${clock(f.starts_at)}–${clock(f.ends_at)}` : `from ${clock(f.starts_at)}`;
  }
  return f.ends_at ? `till ${clock(f.ends_at)}` : '';
};

/**
 * The food line every place card shows (decision point 2). has: true = food tonight,
 * false = known no food on site, null = we don't know. Unknown never reads as no.
 */
export function foodSummary(gf: GroupFit, food: FoodTonight, now = new Date()): { text: string; has: boolean | null } {
  const kitchen = gf.kitchen?.value;
  const trucks = gf.food_trucks?.value;
  if (food) {
    const name = food.title.replace(/^food truck:\s*/i, '').replace(/\s*food truck$/i, '');
    const when = spanLabel(food, now);
    const what = isTruck(food.title) ? `Food truck: ${name}` : name;
    return { text: [kitchen === 'yes' ? 'Kitchen' : null, what + (when ? `, ${when}` : '')].filter(Boolean).join(' + '), has: true };
  }
  if (kitchen === 'yes') return { text: 'Kitchen', has: true };
  if (trucks === 'regular') return { text: 'Usually a food truck · tonight’s not posted', has: null };
  if (kitchen === 'no' && trucks === 'none') return { text: 'No food on site', has: false };
  return { text: 'Food unconfirmed', has: null };
}

export function seatingBadges(gf: GroupFit) {
  const out: string[] = [];
  if (yes(gf, 'covered_outdoor')) out.push('Covered patio');
  else if (yes(gf, 'outdoor_seating')) out.push('Patio');
  if (yes(gf, 'indoor_ac')) out.push('AC inside');
  return out;
}

/** Kids and dogs labels. Unknown never reads as no. */
export function groupLabels(gf: GroupFit, now = new Date()) {
  const out: string[] = [];
  const kids = gf.kids;
  if (kids?.value === 'adults_only') out.push('21+');
  else if (kids?.value === 'welcome' && kids.until) {
    const [h, m] = kids.until.split(':').map(Number);
    const past = now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
    const t = `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`;
    out.push(past ? '21+ now' : `Kids until ${t}`);
  } else if (kids?.value === 'welcome') out.push('Kids welcome');
  if (gf.dogs?.value === 'welcome') out.push('Dogs welcome');
  if (gf.dogs?.value === 'patio_only') out.push('Dogs on patio');
  if (gf.dogs?.value === 'not_allowed') out.push('No dogs');
  return out;
}
