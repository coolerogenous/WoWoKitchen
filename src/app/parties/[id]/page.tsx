"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { partyApi, dishApi, menuApi, PartyDetail, Dish, Menu, shareApi } from "@/lib/api";
import html2canvas from "html2canvas";

export default function PartyDetailPage() {
    // Params
    const params = useParams();
    const idOrCode = params.id as string; // Could be ID (123) or Code (A1B2C3)

    // Auth & Routing
    const { user, isLoading: authLoading } = useAuth(); // User might be null (Guest)
    const router = useRouter();

    // State
    const [party, setParty] = useState<PartyDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Guest Join State
    const [nickname, setNickname] = useState("");
    const [guestToken, setGuestToken] = useState<string | null>(null);
    const [currentGuestId, setCurrentGuestId] = useState<number | 0>(0);

    // Host Add Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [myDishes, setMyDishes] = useState<Dish[]>([]);
    const [myMenus, setMyMenus] = useState<Menu[]>([]);
    const [activeTab, setActiveTab] = useState<"pool" | "orders" | "shopping">("pool");

    // Refs
    const captureRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        // Try to load guest token from local storage for this party
        // We need to know the *real* party ID to store/retrieve token properly, 
        // but initially we might only have code.
        // So let's fetch party first.
        loadParty();
    }, [idOrCode]);

    const loadParty = async () => {
        setLoading(true);
        const res = await partyApi.get(idOrCode);
        setLoading(false);
        if (res.success && res.data) {
            setParty(res.data);
            // Check if we have a stored guest token for this party ID
            const stored = localStorage.getItem(`wk_guest_${res.data.id}`);
            if (stored) {
                setGuestToken(stored);
                // Find guestId? 
                // The API returns guests list. We can match token if we returned it, 
                // but we securely don't return tokens of others. 
                // We only know *our* token. 
                // We can check if our token is in the list? No, API hides tokens.
                // But we can check if we can *select* dishes. 
                // For identifying "Me" in the UI, we assume stored token is valid.
                // We can find our nickname by ... waiting for a "getMe" API? 
                // Or just map guest list by looking for one? No reliable way without API support.
                // Let's iterate guests and see if we can match? No.
                // Update: I should probably return *my* identity in GET /parties/[id] if I pass a header?
                // Or just assume I am a guest if I have a token.
                // For "Selections", I need to know my GuestID to highlight my choices.
                // I'll add a simple logic: API fetches `guests` with `guestToken` masked, 
                // UNLESS it's me? 
                // Actually, let's just rely on `guestToken` for API calls. 
                // For UI "My Selection", I need to know which Guest ID corresponds to my Token.
                // I will ignore this for a moment and just let user Select. 
                // Wait, if I don't know my GuestID, I don't know what I selected in the UI (checkbox state).
                // Block: I need to know my GuestID from my Token.
                // Solution: When joining, I get GuestID. I should store `{token, id, nickname}` in localStorage.
                try {
                    const storedData = JSON.parse(stored);
                    if (storedData.id) setCurrentGuestId(storedData.id);
                } catch { /* old format? */ }
            }
        } else {
            setError(res.error || "无法加载饭局");
        }
    };

    // Derived State
    const isHost = user && party && user.id === party.host.id;
    const isGuest = !!guestToken;
    const canInteract = (isHost || isGuest) && party?.status !== 'LOCKED';

    // Handlers
    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!party) return;
        const res = await partyApi.join(party.id, nickname);
        if (res.success && res.data) {
            const { guestToken, guestId, nickname: nn } = res.data;
            setGuestToken(guestToken);
            setCurrentGuestId(guestId);
            localStorage.setItem(`wk_guest_${party.id}`, JSON.stringify({ token: guestToken, id: guestId, nickname: nn }));
            loadParty(); // reload to get updated guest list
        } else {
            alert(res.error || "加入失败");
        }
    };

    const handleSelect = async (poolDishId: number, currentSelected: boolean) => {
        if (!party || !guestToken) return;
        // Optimistic update? No, let's wait.
        const action = currentSelected ? 'unselect' : 'select';
        const res = await partyApi.selectDish(party.id, guestToken, poolDishId, action);
        if (res.success) {
            loadParty();
        } else {
            alert("操作失败");
        }
    };

    const handleOpenAddModal = async () => {
        // Fetch user's library
        const [d, m] = await Promise.all([dishApi.list(), menuApi.list()]);
        if (d.data) setMyDishes(d.data);
        if (m.data) setMyMenus(m.data);
        setShowAddModal(true);
    };

    const handleAddToPool = async (type: 'dish' | 'menu', id: number) => {
        if (!party) return;
        const payload = type === 'dish' ? { dishId: id } : { menuId: id };
        const res = await partyApi.addToPool(party.id, payload);
        if (res.success) {
            loadParty();
            alert("添加成功");
        } else {
            alert("添加失败");
        }
    };

    const handleRemoveFromPool = async (poolDishId: number) => {
        if (!confirm("确认移除？")) return;
        if (!party) return;
        const res = await partyApi.removeFromPool(party.id, poolDishId);
        if (res.success) loadParty();
    };

    const handleLock = async () => {
        if (!party || !isHost) return;
        const action = party.status === 'LOCKED' ? 'unlock' : 'lock';
        await partyApi.lock(party.id, action);
        loadParty();
    };

    const handleExportImage = async () => {
        if (!captureRef.current) return;
        try {
            const canvas = await html2canvas(captureRef.current);
            const url = canvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.download = `采购清单-${party?.name}.png`;
            link.href = url;
            link.click();
        } catch (err) {
            alert("导出图片失败");
        }
    };

    // Render Helpers
    const renderJoinScreen = () => (
        <div style={styles.centerBox}>
            <h2>👋 加入饭局: {party?.name}</h2>
            <p>主持人: {party?.host.username}</p>
            <form onSubmit={handleJoin} style={{ marginTop: 20 }}>
                <input
                    value={nickname} onChange={e => setNickname(e.target.value)}
                    placeholder="请输入你的昵称" style={styles.input} required
                />
                <button style={styles.btnPrimary}>加入</button>
            </form>
        </div>
    );

    // If not loaded
    if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
    if (!party) return <div style={{ padding: 20 }}>Error: {error}</div>;

    // If not joined and not host, show Join
    if (!isHost && !isGuest) return renderJoinScreen();

    return (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={{ margin: 0 }}>{party.name} <span style={styles.status}>{party.status === 'LOCKED' ? '🔒' : '🟢'}</span></h1>
                    <div style={{ color: '#666', fontSize: 13, marginTop: 5 }}>
                        Code: <strong>{party.shareCode}</strong> (点击复制) | Host: {party.host.username}
                    </div>
                </div>
                {isHost && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={handleLock} style={styles.btnSmall}>
                            {party.status === 'LOCKED' ? '解锁' : '锁定'}
                        </button>
                        <button onClick={() => setActiveTab('shopping')} style={styles.btnSmall}>
                            💰 采购清单
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
                <button style={activeTab === 'pool' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('pool')}>
                    🍽️ 菜品池 ({party.poolDishes.length})
                </button>
                <button style={activeTab === 'orders' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('orders')}>
                    👥 大家的点单
                </button>
                {isHost && (
                    <button style={activeTab === 'shopping' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('shopping')}>
                        🛒 采购预览
                    </button>
                )}
            </div>

            {/* Content */}
            <div style={{ marginTop: 20 }}>
                {activeTab === 'pool' && (
                    <div>
                        {isHost && !party.status.includes('LOCKED') && (
                            <button onClick={handleOpenAddModal} style={{ ...styles.btnPrimary, marginBottom: 15 }}>
                                + 添加菜品/套餐
                            </button>
                        )}

                        <div style={styles.dishGrid}>
                            {party.poolDishes.map(pd => {
                                const isSelected = pd.selections.some(s => s.guest.id === currentGuestId);
                                const selectorNames = pd.selections.map(s => s.guest.nickname).join(', ');
                                return (
                                    <div key={pd.id} style={{
                                        ...styles.dishCard,
                                        border: isSelected ? '2px solid #27ae60' : '1px solid #eee'
                                    }}>
                                        <div style={{ fontWeight: 'bold', fontSize: 16 }}>{pd.dishName}</div>
                                        <div style={{ color: '#e67e22' }}>¥{pd.costSnapshot}</div>

                                        {/* Guest Action */}
                                        {isGuest && party.status === 'ACTIVE' && (
                                            <label style={styles.checkboxLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelect(pd.id, isSelected)}
                                                />
                                                我要吃
                                            </label>
                                        )}

                                        {/* Host Action */}
                                        {isHost && party.status === 'ACTIVE' && (
                                            <button onClick={() => handleRemoveFromPool(pd.id)} style={styles.btnTextRed}>移除</button>
                                        )}

                                        {/* Info */}
                                        {selectorNames && (
                                            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                                                ❤️ {selectorNames}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'orders' && (
                    <div>
                        <h3>宾客列表 ({party.guests.length})</h3>
                        <ul>
                            {party.guests.map(g => (
                                <li key={g.id}>
                                    {g.nickname} {g.id === currentGuestId ? '(我)' : ''}
                                    {/* Show what they ordered? */}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {activeTab === 'shopping' && isHost && (
                    <div ref={captureRef} style={{ background: '#fff', padding: 20, border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <h2>📋 采购清单: {party.name}</h2>
                            <button onClick={handleExportImage} style={styles.btnSmall}>📷 导出为图片</button>
                        </div>
                        <hr />
                        {/* We assume aggregation happens on backend. 
                       Wait, I fetched Detail, which has raw selections. 
                       I need to fetch Export data OR compute locally.
                       For Preview, let's call Export API ? 
                       Or just loop locally if simple.
                       Actually, calling Export API is cleaner. 
                       But user might just want to see it.
                       Let's add a "Load Preview" button or just load it.
                   */}
                        <ShoppingPreview partyId={party.id} />
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3>添加菜品/菜单</h3>
                        <div style={{ display: 'flex', gap: 10, height: 300 }}>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                <h4>菜品 ({myDishes.length})</h4>
                                {myDishes.map(d => (
                                    <div key={d.id} style={styles.listItem}>
                                        <span>{d.name}</span>
                                        <button onClick={() => handleAddToPool('dish', d.id)}>添加</button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ width: 1, background: '#eee' }}></div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                <h4>菜单 ({myMenus.length})</h4>
                                {myMenus.map(m => (
                                    <div key={m.id} style={styles.listItem}>
                                        <span>{m.name}</span>
                                        <button onClick={() => handleAddToPool('menu', m.id)}>添加</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => setShowAddModal(false)} style={styles.btnClose}>关闭</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ShoppingPreview({ partyId }: { partyId: number }) {
    const [data, setData] = useState<any>(null);
    useEffect(() => {
        partyApi.export(partyId).then(res => {
            if (res.success) setData(res.data);
        });
    }, [partyId]);

    if (!data) return <div>Calculating...</div>;

    return (
        <div>
            <p>基于 {data.guestCount} 位宾客的选择</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f9f9f9', textAlign: 'left' }}>
                        <th style={{ padding: 8 }}>食材</th>
                        <th style={{ padding: 8 }}>总量</th>
                        <th style={{ padding: 8 }}>预估费用</th>
                    </tr>
                </thead>
                <tbody>
                    {data.shoppingList.items.map((item: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: 8 }}>{item.name}</td>
                            <td style={{ padding: 8 }}>{item.totalQuantity}{item.unit}</td>
                            <td style={{ padding: 8 }}>¥{item.totalCost.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={2} style={{ padding: 8, fontWeight: 'bold' }}>总计</td>
                        <td style={{ padding: 8, fontWeight: 'bold', color: '#e67e22' }}>¥{data.shoppingList.totalCost.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    centerBox: { maxWidth: 400, margin: '100px auto', padding: 30, background: '#fff', borderRadius: 10, boxShadow: '0 5px 20px rgba(0,0,0,0.1)', textAlign: 'center' },
    input: { padding: '10px 15px', borderRadius: 6, border: '1px solid #ddd', width: '100%', marginBottom: 15, fontSize: 16 },
    btnPrimary: { padding: '10px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15 },
    btnSmall: { padding: '5px 10px', background: '#fff', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
    btnTextRed: { background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', textDecoration: 'underline' },
    header: { padding: '20px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    status: { fontSize: 16, verticalAlign: 'middle' },
    tabs: { display: 'flex', gap: 10, marginTop: 15 },
    tab: { padding: '8px 16px', border: 'none', background: '#f0f0f0', borderRadius: 20, cursor: 'pointer' },
    tabActive: { padding: '8px 16px', border: 'none', background: '#333', color: '#fff', borderRadius: 20, cursor: 'pointer' },
    dishGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 15 },
    dishCard: { background: '#fff', padding: 15, borderRadius: 8, boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'relative' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontWeight: 600, color: '#27ae60' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' },
    modalContent: { background: '#fff', width: 600, borderRadius: 10, padding: 20, maxHeight: '80vh' },
    listItem: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f9f9f9' },
    btnClose: { width: '100%', padding: 10, marginTop: 15, background: '#eee', border: 'none', cursor: 'pointer' },
};
