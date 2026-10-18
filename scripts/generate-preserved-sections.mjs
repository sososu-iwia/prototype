import { readFile, writeFile, mkdir } from "node:fs/promises";
import { load } from "cheerio";
const content = JSON.parse(
  await readFile("packages/content/legacy-kk.json", "utf8"),
);
const attrMap = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  crossorigin: "crossOrigin",
};
function jsx(node) {
  if (node.type === "text") {
    const text = node.data.replace(/\s+/g, " ").trim();
    return text ? `{${JSON.stringify(text)}}` : "";
  }
  if (node.type !== "tag") return "";
  const a = node.attribs || {},
    tag = node.name;
  if (["script", "style"].includes(tag)) return "";
  const key = a["data-i18n"];
  if (tag === "img")
    return `<Media src=${JSON.stringify(a.src)} alt={t(${JSON.stringify(key || "galleryTitle")})} />`;
  const attributes = Object.entries(a)
    .filter(
      ([k]) => !k.startsWith("on") && !k.startsWith("data-") && k !== "style",
    )
    .map(([k, v]) => {
      if (k === "href") {
        if (v === "#") return 'aria-disabled="true"';
        const links = {
          "index.html": "",
          "about.html": "/about",
          "team.html": "/team",
          "matches.html": "/matches",
          "news.html": "/news",
          "#gallery": "/#gallery",
        };
        if (v in links) return `href={\`/\${locale}${links[v]}\`}`;
      }
      return `${attrMap[k] || k}=${JSON.stringify(v)}`;
    })
    .join(" ");
  const children =
    key && key in content
      ? `{t(${JSON.stringify(key)})}`
      : node.children.map(jsx).join("");
  if (["br", "hr", "input", "source"].includes(tag))
    return `<${tag} ${attributes} />`;
  return `<${tag} ${attributes}>${children}</${tag}>`;
}
const $ = load(await readFile("index.html", "utf8")),
  $$ = load(await readFile("about.html", "utf8"));
const sections = [
  ["ClubNumbers", $(".club-stats")[0]],
  ["HomeAbout", $(".about-section")[0]],
  ["HomeAchievements", $(".achievements-section")[0]],
  ["ContactSection", $(".contact-section")[0]],
  ["AboutHero", $$(".about-page-hero")[0]],
  ["AboutIntro", $$(".about-page-intro")[0]],
  ["AboutNumbers", $$(".about-numbers")[0]],
  ["AboutTimeline", $$(".history-section")[0]],
  ["AboutStadium", $$(".stadium-section")[0]],
  ["AboutValues", $$(".values-section")[0]],
  ["AboutCta", $$(".about-cta")[0]],
];
await mkdir("apps/web/components/club", { recursive: true });
let code = `// Generated once from the original semantic HTML. No runtime HTML insertion.\nimport {Media} from '../ui/Media';\nimport type {Locale,SiteKey} from '../../lib/i18n/config';\ntype Props={locale:Locale;t:(key:SiteKey)=>string};\n`;
for (const [name, node] of sections) {
  if (!node) throw Error(`Missing ${name}`);
  code += `export function ${name}({locale,t}:Props){return (${jsx(node)});}\n`;
}
await writeFile("apps/web/components/club/PreservedSections.tsx", code);
let css = await readFile("css/style.css", "utf8");
css = css
  .replaceAll('url("../images/hero.jpg")', 'url("/media/hero-1600.webp")')
  .replaceAll(
    'url("../images/gallery2.jpg")',
    'url("/media/gallery2-960.webp")',
  );
await mkdir("apps/web/styles", { recursive: true });
await writeFile("apps/web/styles/legacy.css", css);
console.log("Preserved 11 original sections and original CSS");
