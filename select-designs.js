const https = require('https');
const fs = require('fs');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'design-selector-script' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  // 1. جلب قائمة كل التصاميم من موقعك
  const xml = await fetchUrl('https://masterdxf.com/sitemap-images.xml');

  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
  const designs = urlBlocks.map(block => {
    const loc = (block.match(/<loc>(.*?)<\/loc>/) || [])[1] || '';
    const imgLoc = (block.match(/<image:loc>(.*?)<\/image:loc>/) || [])[1] || '';
    const imgTitle = (block.match(/<image:title>(.*?)<\/image:title>/) || [])[1] || '';
    return { loc, imageUrl: imgLoc, title: imgTitle };
  }).filter(d => d.loc && d.imageUrl);

  console.log(`Total designs found: ${designs.length}`);

  // 2. قراءة قائمة التصاميم المنشورة سابقًا (لو موجودة)
  let published = [];
  try {
    published = JSON.parse(fs.readFileSync('published.json', 'utf8'));
  } catch (e) {
    published = [];
  }

  // 3. استبعاد المنشور سابقًا
  let candidates = designs.filter(d => !published.includes(d.loc));

  // 4. لو ما بقي عدد كافٍ، ابدأ دورة جديدة (امسح السجل وابدأ من جديد)
  if (candidates.length < 5) {
    console.log('Cycle complete — resetting published list.');
    published = [];
    candidates = designs;
  }

  // 5. اخلط عشوائيًا واختر 5
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const selected = candidates.slice(0, 5);

  // 6. سجّل الجدد كمنشورين
  const newPublished = published.concat(selected.map(d => d.loc));
  fs.writeFileSync('published.json', JSON.stringify(newPublished, null, 2));

  // 7. احفظ النتيجة اللي Make بيقراها
  fs.writeFileSync('latest.json', JSON.stringify({
    designs: selected,
    generatedAt: new Date().toISOString(),
    totalDesigns: designs.length,
    publishedSoFar: newPublished.length
  }, null, 2));

  console.log('Selected designs:');
  selected.forEach(d => console.log(' -', d.title));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
