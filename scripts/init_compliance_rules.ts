
import db, { initDB } from '../api/db.ts';

// Ensure tables exist
initDB();

const rules = [
    // 1. 极限用语 (Forbidden)
    { category: 'forbidden', level: 'BLOCK', keyword: '第一', suggestion: '首选' },
    { category: 'forbidden', level: 'BLOCK', keyword: '顶级', suggestion: '高端' },
    { category: 'forbidden', level: 'BLOCK', keyword: '最', suggestion: '非常' },
    { category: 'forbidden', level: 'BLOCK', keyword: '完美', suggestion: '出色' },
    { category: 'forbidden', level: 'BLOCK', keyword: '独家', suggestion: '独特' },
    { category: 'forbidden', level: 'BLOCK', keyword: '全网首发', suggestion: '新品上市' },
    { category: 'forbidden', level: 'BLOCK', keyword: '万能', suggestion: '多功能' },
    { category: 'forbidden', level: 'BLOCK', keyword: '绝对', suggestion: '真的' },
    { category: 'forbidden', level: 'BLOCK', keyword: '史无前例', suggestion: '少见' },
    { category: 'forbidden', level: 'BLOCK', keyword: '永久', suggestion: '长久' },
    { category: 'forbidden', level: 'BLOCK', keyword: '100%', suggestion: '很高概率' },

    // 2. 引流/营销 (Ad)
    { category: 'ad', level: 'BLOCK', keyword: '微信', suggestion: '绿色软件' },
    { category: 'ad', level: 'BLOCK', keyword: '加我', suggestion: '关注我' },
    { category: 'ad', level: 'BLOCK', keyword: '私信', suggestion: '评论区见' },
    { category: 'ad', level: 'BLOCK', keyword: '购买', suggestion: '入手' },
    { category: 'ad', level: 'BLOCK', keyword: '下单', suggestion: 'Get' },
    { category: 'ad', level: 'BLOCK', keyword: '链接', suggestion: '传送门' },
    { category: 'ad', level: 'WARN', keyword: '价格', suggestion: '米' },
    { category: 'ad', level: 'WARN', keyword: '多少钱', suggestion: '什么价' },
    { category: 'ad', level: 'BLOCK', keyword: '淘宝', suggestion: '某宝' },
    { category: 'ad', level: 'BLOCK', keyword: '京东', suggestion: '某东' },
    
    // 3. 医疗/功效 (Medical)
    { category: 'medical', level: 'BLOCK', keyword: '治疗', suggestion: '改善' },
    { category: 'medical', level: 'BLOCK', keyword: '治愈', suggestion: '缓解' },
    { category: 'medical', level: 'BLOCK', keyword: '药方', suggestion: '方法' },
    { category: 'medical', level: 'BLOCK', keyword: '彻底消除', suggestion: '淡化' },
    { category: 'medical', level: 'WARN', keyword: '排毒', suggestion: '清理' },
    { category: 'medical', level: 'WARN', keyword: '美白', suggestion: '提亮' },
    
    // 4. 诱导互动 (Engagement)
    { category: 'sensitive', level: 'WARN', keyword: '点赞', suggestion: '小心心' },
    { category: 'sensitive', level: 'WARN', keyword: '收藏', suggestion: '马住' },
    { category: 'sensitive', level: 'WARN', keyword: '转发', suggestion: '分享' },
    { category: 'sensitive', level: 'WARN', keyword: '关注', suggestion: '蹲' },
];

console.log(`Starting to import ${rules.length} compliance rules...`);

const insertStmt = db.prepare(`
    INSERT INTO compliance_rules (category, keyword, level, suggestion)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(keyword) DO UPDATE SET
    category = excluded.category,
    level = excluded.level,
    suggestion = excluded.suggestion
`);

db.transaction(() => {
    for (const rule of rules) {
        insertStmt.run(rule.category, rule.keyword, rule.level, rule.suggestion);
        console.log(`Imported: ${rule.keyword}`);
    }
})();

console.log('Compliance rules imported successfully.');
process.exit(0);
