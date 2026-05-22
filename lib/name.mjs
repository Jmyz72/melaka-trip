// splitName("Jonker Walk 鸡场街") → { cn: "鸡场街", main: "Jonker Walk" }
// splitName("芙蓉大巴刹 Seremban Central Market") → { cn: "芙蓉大巴刹", main: "Seremban Central Market" }
// splitName("Seremban Central Market") → { cn: null, main: "Seremban Central Market" }
// splitName("大树下鸭面") → { cn: null, main: "大树下鸭面" }
const CJK = "\\u3400-\\u9FFF\\u3000-\\u303F";
const CJK_RE = new RegExp(`[${CJK}]`);
export function splitName(name) {
  const leading = name.match(new RegExp(`^([${CJK}][${CJK} ·]*?)\\s+([A-Za-z].+)$`));
  if (leading && !CJK_RE.test(leading[2])) return { cn: leading[1].trim(), main: leading[2].trim() };
  const trailing = name.match(new RegExp(`^([A-Za-z][^${CJK}]*?)\\s+([${CJK}][${CJK} ·]*)$`));
  if (trailing) return { cn: trailing[2].trim(), main: trailing[1].trim() };
  return { cn: null, main: name };
}
