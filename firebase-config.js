// 将下方对象替换为你在 Firebase 控制台“项目设置 → 常规 → 你的应用（</> Web）”里复制的配置
// 替换占位符后，协作功能即可生效
window.firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_APP_ID"
};

// 如果已经填了上面的配置，这里会初始化 Firebase 与 Firestore 实例
(function initFirebase() {
    try {
        if (window.firebase && window.firebaseConfig && window.firebaseConfig.apiKey && !firebase.apps.length) {
            firebase.initializeApp(window.firebaseConfig);
            window.db = firebase.firestore();
        }
    } catch (e) {
        console.error('Firebase 初始化失败：', e);
    }
})();

