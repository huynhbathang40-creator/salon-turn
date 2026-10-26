// Display order for technicians: A–Z, with the two owners always at the end (easy to spot).
export const OWNERS = ["q", "pia"]; // shown last, in this order

export function staffOrder(a, b) {
  const ka = (a || "").trim().toLowerCase();
  const kb = (b || "").trim().toLowerCase();
  const oa = OWNERS.indexOf(ka);
  const ob = OWNERS.indexOf(kb);
  if (oa !== ob) return oa === -1 ? -1 : ob === -1 ? 1 : oa - ob;
  return ka.localeCompare(kb, undefined, { sensitivity: "base" });
}

export const sortByName = (list, getName = (x) => x.name) => [...list].sort((a, b) => staffOrder(getName(a), getName(b)));
