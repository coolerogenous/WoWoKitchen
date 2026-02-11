"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { menuApi, dishApi, shareApi, Menu, Dish, ShoppingListItem } from "@/lib/api";

export default function MenusPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [menus, setMenus] = useState<Menu[]>([]);
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [menuName, setMenuName] = useState("");
    const [selectedDishIds, setSelectedDishIds] = useState<number[]>([]);
    const [editId, setEditId] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [viewDetail, setViewDetail] = useState<{
        menu: Menu;
        shoppingList: { items: ShoppingListItem[]; totalCost: number };
    } | null>(null);
    const [shareCode, setShareCode] = useState("");

    useEffect(() => {
        if (!isLoading && !user) { router.replace("/"); return; }
        if (user) loadData();
    }, [user, isLoading, router]);

    const loadData = async () => {
        const [m, d] = await Promise.all([menuApi.list(), dishApi.list()]);
        if (m.success && m.data) setMenus(m.data);
        if (d.success && d.data) setDishes(d.data);
    };

    const resetForm = () => {
        setMenuName("");
        setSelectedDishIds([]);
        setEditId(null);
        setShowForm(false);
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        const data = { name: menuName, dishIds: selectedDishIds };
        const res = editId ? await menuApi.update(editId, data) : await menuApi.create(data);
        if (res.success) { resetForm(); loadData(); }
        else setError(res.error || "操作失败");
    };

    const handleEdit = (menu: Menu) => {
        setMenuName(menu.name);
        setSelectedDishIds(menu.dishes.map((md) => md.dish.id));
        setEditId(menu.id);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("确认删除？")) return;
        const res = await menuApi.delete(id);
        if (res.success) loadData();
        else alert(res.error || "删除失败");
    };

    const handleViewDetail = async (id: number) => {
        const res = await menuApi.get(id);
        if (res.success && res.data) {
            setViewDetail({ menu: res.data, shoppingList: res.data.shoppingList });
        }
    };

    const handleShare = async (id: number) => {
        const res = await shareApi.create("MENU", id);
        if (res.success && res.data) {
            setShareCode(res.data.code);
        } else {
            if (res.error) alert(res.error);
        }
    };

    const toggleDish = (dishId: number) => {
        setSelectedDishIds((prev) =>
            prev.includes(dishId) ? prev.filter((id) => id !== dishId) : [...prev, dishId]
        );
    };

    if (isLoading || !user) return null;

    return (
        <div>
            <div style={styles.header}>
                <h1>📋 菜单管理</h1>
                <button style={styles.addBtn} onClick={() => { resetForm(); setShowForm(true); }}>
                    ➕ 创建菜单
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={styles.form}>
                    <h3>{editId ? "编辑菜单" : "创建菜单"}</h3>
                    <input
                        placeholder="菜单名称（如：年夜饭）"
                        value={menuName}
                        onChange={(e) => setMenuName(e.target.value)}
                        style={{ ...styles.input, width: "100%", marginBottom: 12 }}
                        required
                    />
                    <div style={styles.sectionTitle}>选择菜品</div>
                    <div style={styles.dishCheckboxes}>
                        {dishes.length === 0 ? (
                            <span style={{ color: "#aaa" }}>暂无菜品，请先创建</span>
                        ) : (
                            dishes.map((d) => (
                                <label key={d.id} style={styles.checkbox}>
                                    <input
                                        type="checkbox"
                                        checked={selectedDishIds.includes(d.id)}
                                        onChange={() => toggleDish(d.id)}
                                    />
                                    {d.name} (¥{d.estimatedCost.toFixed(2)})
                                </label>
                            ))
                        )}
                    </div>
                    {error && <div style={styles.error}>{error}</div>}
                    <div style={styles.formActions}>
                        <button type="submit" style={styles.submitBtn}>{editId ? "保存" : "创建"}</button>
                        <button type="button" style={styles.cancelBtn} onClick={resetForm}>取消</button>
                    </div>
                </form>
            )}

            {/* 密语显示 */}
            {shareCode && (
                <div style={styles.tokenDisplay}>
                    <div style={styles.tokenHeader}>
                        <strong>🔐 菜单分享码</strong>
                        <button style={styles.closeBtn} onClick={() => setShareCode("")}>✕</button>
                    </div>
                    <div style={styles.codeText}>{shareCode}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 5, textAlign: 'center' }}>
                        将此 6 位码分享给朋友，在“发现”页输入即可导入。
                    </div>
                    <button
                        style={styles.copyBtn}
                        onClick={() => { navigator.clipboard.writeText(shareCode); alert("已复制！"); }}
                    >
                        📋 复制分享码
                    </button>
                </div>
            )}

            {/* 清单详情弹窗 */}
            {viewDetail && (
                <div style={styles.modal} onClick={() => setViewDetail(null)}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.tokenHeader}>
                            <h3>🛒 {viewDetail.menu.name} — 采购清单</h3>
                            <button style={styles.closeBtn} onClick={() => setViewDetail(null)}>✕</button>
                        </div>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>食材</th>
                                    <th style={styles.th}>总量</th>
                                    <th style={styles.th}>单价</th>
                                    <th style={styles.th}>小计</th>
                                    <th style={styles.th}>来源菜品</th>
                                </tr>
                            </thead>
                            <tbody>
                                {viewDetail.shoppingList.items.map((item, i) => (
                                    <tr key={i}>
                                        <td style={styles.td}>{item.name}</td>
                                        <td style={styles.td}>{item.totalQuantity}{item.unit}</td>
                                        <td style={styles.td}>¥{item.unitPrice.toFixed(2)}</td>
                                        <td style={styles.td}>¥{item.totalCost.toFixed(2)}</td>
                                        <td style={styles.td}>{item.fromDishes.join(", ")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={styles.totalRow}>
                            总计：<strong>¥{viewDetail.shoppingList.totalCost.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* 菜单列表 */}
            <div style={styles.menuGrid}>
                {menus.length === 0 ? (
                    <div style={styles.empty}>暂无菜单</div>
                ) : (
                    menus.map((menu) => {
                        const totalCost = menu.dishes.reduce((sum, md) => sum + md.dish.estimatedCost, 0);
                        return (
                            <div key={menu.id} style={styles.menuCard}>
                                <div style={styles.menuHeader}>
                                    <h3 style={{ margin: 0 }}>{menu.name}</h3>
                                    <span style={styles.menuCost}>¥{totalCost.toFixed(2)}</span>
                                </div>
                                <div style={styles.menuDishes}>
                                    {menu.dishes.map((md) => (
                                        <span key={md.id} style={styles.dishTag}>{md.dish.name}</span>
                                    ))}
                                    {menu.dishes.length === 0 && <span style={{ color: "#aaa", fontSize: 13 }}>暂无菜品</span>}
                                </div>
                                <div style={styles.cardActions}>
                                    <button style={styles.viewBtn} onClick={() => handleViewDetail(menu.id)}>
                                        🛒 采购清单
                                    </button>
                                    <button style={styles.viewBtn} onClick={() => handleShare(menu.id)}>
                                        🔐 生成密语
                                    </button>
                                    <button style={styles.editBtn} onClick={() => handleEdit(menu)}>编辑</button>
                                    <button style={styles.deleteBtn} onClick={() => handleDelete(menu.id)}>删除</button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    addBtn: {
        padding: "8px 18px", border: "none", borderRadius: 8,
        backgroundColor: "#2980b9", color: "#fff", cursor: "pointer", fontSize: 14,
    },
    form: {
        background: "#fff", borderRadius: 10, padding: 20,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)", marginBottom: 20,
    },
    input: { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14 },
    sectionTitle: { fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#555" },
    dishCheckboxes: { display: "flex", flexWrap: "wrap", gap: 12 },
    checkbox: { display: "flex", alignItems: "center", gap: 4, fontSize: 14, cursor: "pointer" },
    error: { color: "#e74c3c", fontSize: 14, marginTop: 8 },
    formActions: { display: "flex", gap: 8, marginTop: 12 },
    submitBtn: {
        padding: "8px 20px", border: "none", borderRadius: 6,
        backgroundColor: "#1a1a2e", color: "#fff", cursor: "pointer",
    },
    cancelBtn: {
        padding: "8px 20px", border: "1px solid #ddd", borderRadius: 6,
        background: "#fff", cursor: "pointer",
    },
    menuGrid: {
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 16, marginTop: 10,
    },
    menuCard: {
        background: "#fff", borderRadius: 10, padding: 20,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    },
    menuHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    menuCost: { color: "#2980b9", fontWeight: 700, fontSize: 18 },
    menuDishes: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 },
    dishTag: {
        background: "#e8f4fd", padding: "3px 10px", borderRadius: 12, fontSize: 12, color: "#2980b9",
    },
    cardActions: { display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" },
    viewBtn: {
        padding: "4px 12px", border: "1px solid #27ae60", borderRadius: 4,
        background: "transparent", color: "#27ae60", cursor: "pointer", fontSize: 13,
    },
    editBtn: {
        padding: "4px 12px", border: "1px solid #3498db", borderRadius: 4,
        background: "transparent", color: "#3498db", cursor: "pointer", fontSize: 13,
    },
    deleteBtn: {
        padding: "4px 12px", border: "1px solid #e74c3c", borderRadius: 4,
        background: "transparent", color: "#e74c3c", cursor: "pointer", fontSize: 13,
    },
    empty: { padding: 40, textAlign: "center", color: "#aaa", gridColumn: "1 / -1" },
    tokenDisplay: {
        background: "#fff", borderRadius: 10, padding: 20,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)", marginBottom: 20, textAlign: 'center'
    },
    tokenHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    closeBtn: {
        background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "#888",
    },
    codeText: {
        fontSize: 32, fontWeight: 700, letterSpacing: 4, color: "#2c3e50", margin: "10px 0", fontFamily: "monospace"
    },
    copyBtn: {
        marginTop: 15, padding: "8px 24px", border: "none", borderRadius: 6,
        backgroundColor: "#27ae60", color: "#fff", cursor: "pointer", fontSize: 14,
    },
    modal: {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center",
        alignItems: "center", zIndex: 1000,
    },
    modalContent: {
        background: "#fff", borderRadius: 12, padding: 24, maxWidth: 700,
        width: "90%", maxHeight: "80vh", overflowY: "auto",
    },
    table: { width: "100%", borderCollapse: "collapse", marginTop: 12 },
    th: {
        textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #eee",
        fontSize: 13, color: "#888",
    },
    td: { padding: "8px 12px", fontSize: 14, borderBottom: "1px solid #f0f0f0" },
    totalRow: {
        textAlign: "right", padding: "16px 12px", fontSize: 18, color: "#e67e22",
    },
};
