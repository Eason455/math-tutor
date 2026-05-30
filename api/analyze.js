/**
 * 数学私教 - 两步流水线 API
 * Step 1: MiMo-V2.5  视觉 OCR → 逐字提取题目原文
 * Step 2: DeepSeek V4 数学推理 → 深度分析 + 讲解
 */

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const startTime = Date.now();

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: '请提供图片' });

    const xiaomiKey = process.env.XIAOMI_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    if (!xiaomiKey) return res.status(500).json({ error: 'MiMo API Key 未配置' });
    if (!deepseekKey) return res.status(500).json({ error: 'DeepSeek API Key 未配置' });

    // ============================================
    // STEP 1: MiMo-V2.5 视觉 OCR
    // ============================================
    console.log('[Step 1] MiMo OCR starting...');

    // 压缩图片：限制 base64 在 1MB 以内（约 750KB 原始图片）
    let imgData = image;
    if (imgData.includes(',')) imgData = imgData.split(',')[1];
    if (imgData.length > 1300000) {
      console.log('  Image compressed: ' + imgData.length + ' -> 1300000 chars');
      imgData = imgData.substring(0, 1300000);
    }
    imgData = 'data:image/jpeg;base64,' + imgData;

    const mimoBody = JSON.stringify({
      model: 'mimo-v2.5',
      messages: [
        {
          role: 'system',
          content: '你是一台高精度 OCR 文字识别机器。你的唯一任务是从图片中逐字提取所有可见的中文和数学符号。\n\n规则：\n1. 逐行输出图片中的所有文字，一字不漏、一字不改\n2. 数学符号、公式、数字必须原样保留（如 f(x)、x²、∈、∪、∫、→ 等）\n3. 如果有多个小题（如 (1)(2)(3)），分行列出\n4. 如果图片中有图/坐标系/几何图形，用文字描述\n5. 不要添加任何解释、分析、评论\n6. 如果图片中没有文字或无法辨认，输出「OCR_FAILED: 无法识别图片中的文字」\n\n输出格式：\n【提取的题目原文】\n（逐行输出图片中的所有文字内容）'
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imgData } },
            { type: 'text', text: '请逐字提取图片中所有文字和数学符号，一字不改。' }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.1
    });

    const mimoResult = await callAPI(
      'api.xiaomimimo.com', '/v1/chat/completions', mimoBody, xiaomiKey, 30000
    );

    const ocrText = mimoResult.choices?.[0]?.message?.content || '';
    const ocrMs = Date.now() - startTime;

    // 判断 OCR 是否成功
    const ocrFailed = !ocrText || ocrText.includes('OCR_FAILED') || ocrText.length < 5;

    if (ocrFailed) {
      return res.status(200).json({
        success: false,
        ocr_text: ocrText || '(OCR 失败)',
        analysis: '',
        error: 'OCR_FAILED',
        message: '无法识别图片中的文字。请确保：\n1. 题目清晰、光线充足\n2. 文字在图片中央\n3. 背景干净无杂物\n\n你也可以直接在输入框粘贴题目文字。',
        timing: { ocr: ocrMs }
      });
    }

    // ============================================
    // STEP 2: DeepSeek V4 数学深度分析
    // ============================================
    console.log('[Step 2] DeepSeek analysis starting...');

    const deepseekBody = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一位资深高中数学教师，拥有 20 年教学经验。你的学生是高一学生，刚接触高中数学。\n\n你的回答结构如下（用 markdown 分隔）：\n\n## 📖 题目\n（复述题目）\n\n## 🔑 考查知识点\n（列出 2-5 个相关知识点，每个一行，标注所属章节）\n\n## ❌ 常见错误\n（列出学生最容易犯的 2-3 个错误及原因）\n\n## ✅ 解题步骤\n（分步骤讲解，每步标注序号。使用清晰的中文，避免跳步）\n\n## 💡 解题技巧\n（1-2 个实用技巧或口诀，帮助理解和记忆）\n\n## 🎯 同类练习\n（出 1-2 道同类变式题，标注难度 ⭐）\n\n要求：\n- 语言亲切易懂，像私教面对面讲解\n- 数学符号用标准写法（如 x²、√、π、∈ 等）\n- 关键步骤加粗或用 ▶ 标记\n- 总字数控制在 500-1000 字'
        },
        {
          role: 'user',
          content: '下面是通过 OCR 从学生拍摄的数学题图片中提取的文字。请按你的格式分析这道题。\n\n【OCR 提取的题目】\n' + ocrText + '\n\n请开始分析。'
        }
      ],
      max_tokens: 2500,
      temperature: 0.3
    });

    const deepseekResult = await callAPI(
      'api.deepseek.com', '/v1/chat/completions', deepseekBody, deepseekKey, 45000
    );

    const analysis = deepseekResult.choices?.[0]?.message?.content || '';
    const totalMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      ocr_text: ocrText,
      analysis: analysis,
      timing: {
        ocr: ocrMs,
        analysis: totalMs - ocrMs,
        total: totalMs
      },
      model: 'MiMo-V2.5 (OCR) + DeepSeek-Chat (分析)'
    });

  } catch (e) {
    console.error('[Error]', e.message);
    const msg = e.message === 'timeout' ? 'AI 响应超时，请重试或裁剪图片' : e.message;
    return res.status(500).json({ error: msg });
  }
};

/**
 * 通用 HTTPS API 调用函数
 */
function callAPI(hostname, path, body, apiKey, timeoutMs) {
  const https = require('https');

  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      req.destroy();
      reject(new Error('timeout'));
    }, timeoutMs);

    const req = https.request({
      hostname,
      port: 443,
      path,
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        clearTimeout(t);
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || JSON.stringify(json.error)));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', e => { clearTimeout(t); reject(e); });
    req.on('timeout', () => { clearTimeout(t); req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}
