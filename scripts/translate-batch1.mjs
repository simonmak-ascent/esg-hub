import Surreal from "surrealdb";

const endpoint = (process.env.SURREAL_URL || "");
const db = new Surreal();

function escapeStr(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const translations = [
  { id: "page:07ai98psaot1gm16eff2", title_zh: "雇佣关系", title_hi: "रोजगार संबंध", description_zh: "社会责任、利益相关者影响和ISO 26000对齐的劳动实践子主题。免费ESG资源。", description_hi: "सामाजिक जिम्मेदारी, हितधारक प्रभावों और ISO 26000 संरेखण को कवर करने वाला श्रम अभ्यास उप-विषय। मुफ्त ESG संसाधन।" },
  { id: "page:0iaah0j7iq643o7u1b7f", title_zh: "港交所气候披露", title_hi: "HKEX जलवारहरण प्रकटीकरण", description_zh: "亚太区ESG法规指南，涵盖披露要求，时间线和合规要求。地区可持续发展资源。", description_hi: "प्रकटीकरण आवश्यकताओं, समयसीमा और अनुपालन को कवर करने वाला एशिया-प्रशांत ESG विनियम गाइड। क्षेत्रीय स्थिरता संसाधन।" },
  { id: "page:0t1bu7pxt5onm40eqwyq", title_zh: "财富与收入创造", title_hi: "धन और आय सृजन", description_zh: "社会责任、利益相关者影响和ISO 26000对齐的社区参与子主题。", description_hi: "सामाजिक जिम्मेदारी, हितधारक प्रभावों और ISO 26000 संरेखण को कवर करने वाला सामुदायिक भागीदारी उप-विषय।" },
  { id: "page:116rr486dg6vl34q88g5", title_zh: "董事会构成", title_hi: "बोर्ड संरचना", description_zh: "企业治理原则、经合组织指南和ESG披露要求的董事会职责子主题。", description_hi: "कॉर्पोरेट शासन सिद्धांतों, OECD दिशानिर्देशों और ESG प्रकटीकरण आवश्यकताओं को कवर करने वाला बोर्ड जिम्मेदारियां उप-विषय।" },
  { id: "page:144yfqyzxfilpnsdepv3", title_zh: "风险披露", title_hi: "जोखिम प्रकटीकरण", description_zh: "企业治理原则、经合组织指南和ESG披露要求的披露与透明度子主题。", description_hi: "कॉर्पोरेट शासन सिद्धांतों, OECD दिशानिर्देशों और ESG प्रकटीकरण आवश्यकताओं को कवर करने वाला प्रकटीकरण और पारदर्शिता उप-विषय।" },
];

async function main() {
  await db.connect(`${endpoint}/rpc`);
  await db.signin({ username: "root", password: process.env.SURREAL_PASSWORD || "" });
  await db.use({ namespace: "esg_hub", database: "main" });
  
  let count = 0;
  for (const t of translations) {
    try {
      // Include backlinks field as empty array to satisfy schema
      const sql = `UPDATE (${t.id}) SET title_zh = '${escapeStr(t.title_zh)}', title_hi = '${escapeStr(t.title_hi)}', description_zh = '${escapeStr(t.description_zh)}', description_hi = '${escapeStr(t.description_hi)}', backlinks = []`;
      await db.query(sql);
      console.log(`✓ ${t.id}`);
      count++;
    } catch (e) {
      console.log(`✗ ${t.id}: ${e.message}`);
    }
  }
  
  console.log(`\n✅ Updated ${count} pages`);
  await db.close();
}

main();
