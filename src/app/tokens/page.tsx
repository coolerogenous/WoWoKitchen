"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { shareApi, tokenApi } from "@/lib/api";

export default function TokensPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [importResult, setImportResult] = useState<string | null>(null);

    // 允许未登录访问此页面用于输入分享码（特别是饭局码）
    // 但导入菜单/菜品需要登录

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setImportResult(null);
        setLoading(true);

        try {
            // 1. 解析分享码
            const res = await shareApi.get(code);

            if (!res.success || !res.data) {
                setError(res.error || "无效的分享码");
                setLoading(false);
                return;
            }

            const { type, data } = res.data;

            if (type === "PARTY") {
                // 是饭局，跳转到饭局详情页
                router.push(`/parties/${code}`);
                return;
            }

            // 是 Dish 或 Menu，需要导入
            if (!user) {
                setError("导入菜品/菜单需要先登录");
                setLoading(false);
                return;
            }

            // 2. 调用导入接口
            const importRes = await tokenApi.importData(data);

            if (importRes.success && importRes.data) {
                const r = importRes.data;
                let msg = "导入成功！";
                if (r.menuCreated) {
                    msg += ` 菜单: ${r.menuName}`;
                }
                msg += ` (新增食材: ${r.ingredientsCreated}, 复用食材: ${r.ingredientsReused})`;
                setImportResult(msg);
                setCode(""); // 清空以便下次输入
            } else {
                setError(importRes.error || "导入失败");
            }

        } catch (err) {
            console.error(err);
            setError("网络错误");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <h1 style={{ marginBottom: 10 }}>🔍 发现与导入</h1>
            <p style={{ color: '#666', marginBottom: 40 }}>
                输入 6 位分享码，加入饭局或获取已分享的菜谱。
            </p>

            <div style={styles.card}>
                <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <input
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="A1B2C3"
                        maxLength={6}
                        style={styles.input}
                    />
                    <button disabled={loading} style={styles.btn}>
                        {loading ? "查询中..." : "🚀 前往 / 导入"}
                    </button>
                </form>

                {error && <div style={styles.error}>{error}</div>}
                {importResult && <div style={styles.success}>{importResult}</div>}
            </div>

            {!user && (
                <div style={{ marginTop: 40, fontSize: 13, color: '#888' }}>
                    💡 提示：加入饭局无需登录，但导入菜谱需先<a href="/" style={{ color: '#333', textDecoration: 'underline' }}>登录</a>。
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: { maxWidth: 600, margin: "60px auto", padding: 20, textAlign: 'center' },
    card: { background: '#fff', padding: 40, borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' },
    input: {
        fontSize: 32, letterSpacing: 8, width: 240, textAlign: 'center', padding: "12px 0",
        border: 'none', borderBottom: '2px solid #eee', outline: 'none', marginBottom: 30,
        textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 'bold', color: '#333'
    },
    btn: {
        padding: "12px 40px", fontSize: 16, fontWeight: 600, borderRadius: 30,
        background: "#1a1a2e", color: "#fff", border: "none", cursor: "pointer",
        transition: 'transform 0.1s', boxShadow: '0 4px 12px rgba(26,26,46,0.2)'
    },
    error: { marginTop: 20, color: "#e74c3c", background: '#fdedec', padding: '10px 20px', borderRadius: 8 },
    success: { marginTop: 20, color: "#27ae60", background: '#edf7ed', padding: '10px 20px', borderRadius: 8 },
};
