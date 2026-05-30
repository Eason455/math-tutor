/**
 * Health check endpoint - test if Vercel function is alive
 */
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
    env: {
      mimo: !!process.env.XIAOMI_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY
    }
  });
};
