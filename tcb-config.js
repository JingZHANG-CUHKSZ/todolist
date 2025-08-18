// 腾讯云开发配置
// 请到 https://console.cloud.tencent.com/tcb 创建环境后填入envId
window.tcbConfig = {
    env: "YOUR_ENV_ID" // 替换为你的环境ID，例如：tcb-demo-xxxx
};

// 初始化腾讯云开发
(function initTCB() {
    if (window.cloudbase && window.tcbConfig && window.tcbConfig.env !== "YOUR_ENV_ID") {
        try {
            window.app = cloudbase.init({
                env: window.tcbConfig.env
            });
            window.db = app.database();
            console.log('腾讯云开发初始化成功');
        } catch (e) {
            console.error('腾讯云开发初始化失败：', e);
        }
    }
})();
