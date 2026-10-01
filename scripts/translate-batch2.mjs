import Surreal from "surrealdb";

const endpoint = (process.env.SURREAL_URL || "");
const db = new Surreal();

function escapeStr(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Batch 2 translations
const translations = [
  { id: "page:160lnxxbp0w4zeo7ch2c", title_zh: "海洋与海洋保护", title_hi: "समुद्री और महासागर संरक्षण", description_zh: "了解海洋健康、海洋生物多样性，以及企业如何影响和保护海洋生态系统。", description_hi: "समुद्री स्वास्थ्य, समुद्री जैव-विविधता, और व्यवसाय कैसे प्रभावित कर सकते हैं और समुद्री पारिस्थितिकी की रक्षा कर सकते हैं।" },
  { id: "page:16djbzea0wzexbn0vo9a", title_zh: "ESRS：欧洲可持续发展报告标准", title_hi: "ESRS: यूरोपीय स्थिरता रिपोर्टिंग मानक", description_zh: "了解CSRD合规和全面ESG报告的ESRS披露要求。", description_hi: "CSRD अनुपालन और व्यापक ESG रिपोर्टिंग के लिए ESRS प्रकटीकरण आवश्यकताओं को समझना।" },
  { id: "page:16qd7mrfqeimo737fdw9", title_zh: "举报与直言文化", title_hi: "घूसखोरी और बोलने की संस्कृति", description_zh: "ESG枢纽综合资源，由Ascent Partners Foundation创建的可免费访问的百科全书。", description_hi: "ESG हब व्यापक संसाधन, Ascent Partners Foundation द्वारा बनाया गया मुक्त-पहुंच विश्वकोश।" },
  { id: "page:1pobhizkw8ecux1jhf3v", title_zh: "财务报告与披露", title_hi: "वित्तीय रिपोर्टिंग और प्रकटीकरण", description_zh: "ESG枢纽综合资源，由Ascent Partners Foundation创建的可免费访问的百科全书。", description_hi: "ESG हब व्यापक संसाधन, Ascent Partners Foundation द्वारा बनाया गया मुक्त-पहुंच विश्वकोश।" },
  { id: "page:1rzbue3w0likh0vogtza", title_zh: "包容性决策", title_hi: "हितधारक-समावेशी निर्णय लेना", description_zh: "ESG枢纽综合资源，由Ascent Partners Foundation创建的可免费访问的百科全书。", description_hi: "ESG हब व्यापक संसाधन, Ascent Partners Foundation द्वारा बनाया गया मुक्त-पहुंच विश्वकोश।" },
  { id: "page:1u4gdoseknyz6375wo9h", title_zh: "反腐败与反贿赂法", title_hi: "भ्रष्टाचार और घूस-विरोधी कानून", description_zh: "ESG枢纽综合参考", description_hi: "ESG हब व्यापक संदर्भ" },
  { id: "page:20zz0z0bjewxrohgzzjb", title_zh: "气候变化（行星边界1）", title_hi: "जलवायु परिवर्तन (पीबी1)", description_zh: "行星边界分析，包括状态评估、关键指标和ESG报告框架。免费访问的ESG百科全书。", description_hi: "स्थिति आकलन, प्रमुख मीट्रिक और ESG रिपोर्टिंग ढांचे के साथ ग्रहीय सीमा विश्लेषण। मुक्त-पहुंच ESG विश्वकोश।" },
  { id: "page:21ffnqh3yygylxyd3v3v", title_zh: "残障包容", title_hi: "विकलांगता समावेश", description_zh: "ESG枢纽综合资源，由Ascent Partners Foundation创建的可免费访问的百科全书。", description_hi: "ESG हब व्यापक संसाधन, Ascent Partners Foundation द्वारा बनाया गया मुक्त-पहुंच विश्वकोश।" },
  { id: "page:22ogxdem6bwgonj50srl", title_zh: "工人健康与安全", title_hi: "कार्यकर्ता स्वास्थ्य और सुरक्षा", description_zh: "ESG枢纽综合参考", description_hi: "ESG हब व्यापक संदर्भ" },
  { id: "page:2dth82oqmir68ualdjg1", title_zh: "生物多样性补偿", title_hi: "जैव-विविधता ऑफसेट", description_zh: "了解生物多样性补偿、缓解银行和为不可避免的环境影响进行补偿。", description_hi: "जैव-विविधता ऑफसेट, शमन बैंकिंग और अपरिहार्य पर्यावरणीय प्रभावों के लिए क्षतिपूर्ति को समझना।" },
  { id: "page:2n34fu6ulrma1izab8at", title_zh: "供应链责任", title_hi: "आपूर्ति श्रृंखला जिम्मेदारी", description_zh: "ESG枢纽综合资源，由Ascent Partners Foundation创建的可免费访问的百科全书。", description_hi: "ESG हब व्यापक संसाधन, Ascent Partners Foundation द्वारा बनाया गया मुक्त-पहुंच विश्वकोश।" },
  { id: "page:2o681ssuvj3m9r7rdcua", title_zh: "文化遗产保护", title_hi: "सांस्कृतिक विरासत संरक्षण", description_zh: "ESG枢纽综合资源，由Ascent Partners Foundation创建的可免费访问的百科全书。", description_hi: "ESG हब व्यापक संसाधन, Ascent Partners Foundation द्वारा बनाया गया मुक्त-पहुंच विश्वकोश।" },
  { id: "page:2z9xgdiwjubg9ijyx91w", title_zh: "水资源与管理", title_hi: "जल संसाधन और प्रबंधन", description_zh: "行星边界分析，包括状态评估、关键指标和ESG报告框架。免费访问的ESG百科全书。", description_hi: "स्थिति आकलन, प्रमुख मीट्रिक और ESG रिपोर्टिंग ढांचे के साथ ग्रहीय सीमा विश्लेषण। मुक्त-पहुंच ESG विश्वकोश।" },
  { id: "page:31q2pxtk55k69qw2c9jo", title_zh: "道德领导力", title_hi: "नैतिक नेतृत्व", description_zh: "ESG枢纽综合资源，由Ascent Partners Foundation创建的可免费访问的百科全书。", description_hi: "ESG हब व्यापक संसाधन, Ascent Partners Foundation द्वारा बनाया गया मुक्त-पहुंच विश्वकोश।" },
  { id: "page:34315v3w5218aakfpkqn", title_zh: "环境正义", title_hi: "पर्यावरणीय न्याय", description_zh: "ESG枢纽综合参考", description_hi: "ESG हब व्यापक संदर्भ" },
  { id: "page:3a0nqxg2c6s1mx6nme0", title_zh: "生物多样性与生态系统", title_hi: "जैव-विविधता और पारिस्थितिकी तंत्र", description_zh: "ESG枢纽综合资源", description_hi: "ESG हब व्यापक संसाधन" },
  { id: "page:3b5k7v9c8y2x4mw7nq0", title_zh: "碳中和", title_hi: "कार्बन न्यूट्रैलिटी", description_zh: "了解碳中和目标、净零排放承诺和气候行动。", description_hi: "कार्बन न्यूट्रैलिटी लक्ष्यों, शुन्य-शुद्ध उत्सर्जन प्रतिबद्धताओं और जलवायु कार्रवाई को समझना।" },
  { id: "page:3c8h5j2k9v1n4m7x0b3", title_zh: "可持续发展目标", title_hi: "स्थायी विकास लक्ष्य", description_zh: "联合国可持续发展目标（SDGs）及其与ESG的关系。", description_hi: "संयुक्त राष्ट्र के स्थायी विकास लक्ष्य (SDGs) और ESG के साथ их संबंध।" },
  { id: "page:3d9k4m8n2v5c7x1b6y0", title_zh: "公司治理", title_hi: "कॉर्पोरेट शासन", description_zh: "ESG枢纽综合资源", description_hi: "ESG हब व्यापक संसाधन" },
  { id: "page:3f2n7c9k4v8x1m5b0y3", title_zh: "企业社会责任", title_hi: "कॉर्पोरेट सामाजिक जिम्मेदारी", description_zh: "企业社会责任（CSR）原则和实践。", description_hi: "कॉर्पोरेट सामाजिक जिम्मेदारी (CSR) सिद्धांत और अभ्यास।" },
];

async function main() {
  await db.connect(`${endpoint}/rpc`);
  await db.signin({ username: "root", password: process.env.SURREAL_PASSWORD || "" });
  await db.use({ namespace: "esg_hub", database: "main" });
  
  let count = 0;
  for (const t of translations) {
    try {
      const sql = `UPDATE (${t.id}) SET title_zh = '${escapeStr(t.title_zh)}', title_hi = '${escapeStr(t.title_hi)}', description_zh = '${escapeStr(t.description_zh)}', description_hi = '${escapeStr(t.description_hi)}'`;
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
