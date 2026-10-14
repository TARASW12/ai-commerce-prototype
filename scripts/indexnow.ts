/**
 * Ping IndexNow with every public URL.
 *
 * IndexNow is the open protocol Bing, Yandex, Seznam and Naver accept for
 * "this URL is new, come and look" — it turns discovery from a crawl that may
 * take days into one that usually happens within hours. Worth running on every
 * deploy; a product page nobody has indexed is a product page no assistant can
 * cite.
 *
 * It is not a guarantee, and it does not reach every engine: Perplexity runs
 * its own crawler. But it costs nothing and it is the only lever a brand-new
 * domain actually has.
 */
export {};

const KEY = "4b9f7f01e38b087695e168e061ff840e";
const HOST = "ai-commerce-prototype.vercel.app";

async function main() {
  const res = await fetch(`https://${HOST}/sitemap.xml`);
  const xml = await res.text();
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList,
  };

  const r = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  console.log(`IndexNow → HTTP ${r.status} ${r.statusText}`);
  console.log(`submitted ${urlList.length} URLs:`);
  for (const u of urlList) console.log("  " + u);
  if (r.status !== 200 && r.status !== 202) console.log(await r.text());
}

main().catch((e) => { console.error(e); process.exit(1); });
