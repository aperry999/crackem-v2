import type { GroupFit } from './api';

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

/** "Food truck tonight: X", "Kitchen", or null. */
export function foodLine(gf: GroupFit, truckTonight: string | null) {
  if (truckTonight) return truckTonight.replace(/^food truck:\s*/i, 'Food truck tonight: ');
  if (yes(gf, 'kitchen')) return 'Kitchen';
  return null;
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
