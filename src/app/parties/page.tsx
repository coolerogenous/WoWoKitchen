"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { partyApi, Party } from "@/lib/api";

export default function PartiesPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [parties, setParties] = useState<Party[]>([]);
    const [newPartyName, setNewPartyName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isLoading && user) {
            loadParties();
        }
    }, [user, isLoading]);

    const loadParties = async () => {
        const res = await partyApi.list();
        if (res.success && res.data) {
            setParties(res.data);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPartyName.trim()) return;

        setLoading(true);
        const res = await partyApi.create({ name: newPartyName });
        setLoading(false);

        if (res.success && res.data) {
            setNewPartyName("");
            loadParties();
            router.push(`/parties/${res.data.id}`);
        } else {
            alert(res.error || "创建失败");
        }
    };

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (joinCode.length !== 6) {
            alert("请输入 6 位分享码");
            return;
        }
        // Deep link to detail page which handles join logic
        // But we need to resolve code to ID first if we want clean URL /parties/123
        // Or support /parties/CODE directly. My API supports ID or Code. 
        // So /parties/CODE is fine if I implement the dynamic route to handle it.
        router.push(`/parties/${joinCode}`);
    };

    // 访客也可以看到"加入"框，但创建需要登录
    // 如果未登录，只显示加入框? 
    // 简单处理：未登录强制重定向去登录页 (AuthContext logic).
    // 但需求说 "游客可以通过链接..."，如果游客没账号怎么办？
    // 游客模式：不需要登录账号，只需要昵称。
    // 所以 PartiesPage 应该允许未登录访问？
    // 但 /parties 是 "我的饭局列表"，这个必须登录。
    // /parties/[id] 是详情，应该允许未登录。
    // 这里的 Page 是列表页，强制登录。

    if (isLoading) return <div>Loading...</div>;
    if (!user) {
        // Show simple join form for guests who landed here by mistake?
        // Or redirect to login. Redirect is safer for /parties root.
        router.push("/");
        return null;
    }

    return (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
            <h1 style={{ marginBottom: 30 }}>🎉 我的饭局</h1>

            <div style={styles.actionRow}>
                {/* 创建卡片 */}
                <div style={styles.card}>
                    <h3 style={{ marginBottom: 15 }}>发起新饭局</h3>
                    <form onSubmit={handleCreate}>
                        <input
                            value={newPartyName}
                            onChange={(e) => setNewPartyName(e.target.value)}
                            placeholder="输入饭局名称..."
                            style={styles.input}
                            required
                        />
                        <button type="submit" style={styles.btnPrimary} disabled={loading}>
                            {loading ? "创建中..." : "👉 发起"}
                        </button>
                    </form>
                </div>

                {/* 加入卡片 */}
                <div style={styles.card}>
                    <h3 style={{ marginBottom: 15 }}>加入已有饭局</h3>
                    <form onSubmit={handleJoin}>
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="输入 6 位分享码..."
                            maxLength={6}
                            style={styles.input}
                            required
                        />
                        <button type="submit" style={styles.btnSecondary}>
                            🚀 前往
                        </button>
                    </form>
                </div>
            </div>

            <h3 style={{ marginTop: 40, marginBottom: 20 }}>进行中 ({parties.length})</h3>

            {parties.length === 0 && <div style={{ color: "#888", textAlign: "center", padding: 40 }}>暂无饭局</div>}

            <div style={styles.grid}>
                {parties.map((p) => (
                    <div key={p.id} style={styles.partyCard} onClick={() => router.push(`/parties/${p.id}`)}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <h4>{p.name}</h4>
                            <span style={{ fontSize: 12, padding: "2px 8px", background: p.status === "LOCKED" ? "#eee" : "#dcfce7", borderRadius: 10, color: p.status === "LOCKED" ? "#888" : "#16a34a" }}>
                                {p.status === "LOCKED" ? "锁定" : "进行中"}
                            </span>
                        </div>
                        <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
                            <div>Code: <strong style={{ fontFamily: "monospace", fontSize: 14 }}>{p.shareCode}</strong></div>
                            <div style={{ marginTop: 4 }}>
                                {p._count?.guests || 0} 位宾客 • {p._count?.poolDishes || 0} 道备选菜
                            </div>
                            <div style={{ marginTop: 4, fontSize: 12, color: '#aaa' }}>
                                创建于 {new Date(p.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    actionRow: { display: "flex", gap: 20, flexDirection: "row", flexWrap: "wrap" },
    card: { flex: 1, minWidth: 280, background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid #f0f0f0" },
    input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", marginBottom: 12, fontSize: 15 },
    btnPrimary: { width: "100%", padding: "10px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 },
    btnSecondary: { width: "100%", padding: "10px", background: "#fff", color: "#1a1a2e", border: "1px solid #1a1a2e", borderRadius: 8, cursor: "pointer", fontWeight: 600 },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 },
    partyCard: { background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #eee", cursor: "pointer", transition: "transform 0.1s", userSelect: "none" },
};
