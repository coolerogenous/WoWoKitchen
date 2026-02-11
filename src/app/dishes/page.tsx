"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { dishApi, ingredientApi, shareApi, Dish, Ingredient } from "@/lib/api";

export default function DishesPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [dishName, setDishName] = useState("");
    const [selectedIngredients, setSelectedIngredients] = useState<
        { ingredientId: number; quantity: string; unit: string }[]
    >([]);
    const [error, setError] = useState("");
    const [shareCode, setShareCode] = useState("");

    useEffect(() => {
        if (!isLoading && !user) { router.replace("/"); return; }
        if (user) loadData();
    }, [user, isLoading, router]);

    const loadData = async () => {
        const [d, i] = await Promise.all([dishApi.list(), ingredientApi.list()]);
        if (d.success && d.data) setDishes(d.data);
        if (i.success && i.data) setIngredients(i.data);
    };

    const resetForm = () => {
        setDishName("");
        setSelectedIngredients([]);
        setEditId(null);
        setShowForm(false);
        setError("");
    };

    const addIngredientRow = () => {
        setSelectedIngredients([...selectedIngredients, { ingredientId: 0, quantity: "", unit: "g" }]);
    };

    const removeIngredientRow = (index: number) => {
        setSelectedIngredients(selectedIngredients.filter((_, i) => i !== index));
    };

    const updateIngredientRow = (index: number, field: string, value: string | number) => {
        const updated = [...selectedIngredients];
        updated[index] = { ...updated[index], [field]: value };
        setSelectedIngredients(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (selectedIngredients.length === 0) {
            setError("请至少添加一种食材");
            return;
        }

        const data = {
            name: dishName,
            ingredients: selectedIngredients.map((si) => ({
                ingredientId: si.ingredientId,
                quantity: parseFloat(si.quantity),
                unit: si.unit,
            })),
        };

        const res = editId ? await dishApi.update(editId, data) : await dishApi.create(data);

        if (res.success) {
            resetForm();
            loadData();
        } else {
            setError(res.error || "操作失败");
        }
    };

    const handleEdit = (dish: Dish) => {
        setDishName(dish.name);
        setSelectedIngredients(
            dish.ingredients.map((di) => ({
                ingredientId: di.ingredientId,
                quantity: String(di.quantity),
                unit: di.unit,
            }))
        );
        setEditId(dish.id);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("确认删除？")) return;
        const res = await dishApi.delete(id);
        if (res.success) loadData();
        else alert(res.error || "删除失败");
    };

    const handleShare = async (id: number) => {
        const res = await shareApi.create("DISH", id);
        if (res.success && res.data) {
            setShareCode(res.data.code);
        } else {
            if (res.error) alert(res.error);
        }
    };

    if (isLoading || !user) return null;

    return (
        <div>
            <div style={styles.header}>
                <h1>🍳 菜品管理</h1>
                <button style={styles.addBtn} onClick={() => { resetForm(); setShowForm(true); }}>
                    ➕ 创建菜品
                </button>
            </div>

            {ingredients.length === 0 && (
                <div style={styles.tip}>
                    ⚠️ 请先到 <a href="/ingredients" style={{ color: "#3498db" }}>食材管理</a> 添加食材
                </div>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} style={styles.form}>
                    <h3>{editId ? "编辑菜品" : "创建菜品"}</h3>
                    <input
                        placeholder="菜品名称（如：青椒肉丝）"
                        value={dishName}
                        onChange={(e) => setDishName(e.target.value)}
                        style={{ ...styles.input, marginBottom: 12 }}
                        required
                    />
                    <div style={styles.sectionTitle}>
                        食材配方 (BOM)
                        <button type="button" style={styles.smallBtn} onClick={addIngredientRow}>
                            + 添加食材
                        </button>
                    </div>
                    {selectedIngredients.map((si, idx) => (
                        <div key={idx} style={styles.ingredientRow}>
                            <select
                                value={si.ingredientId}
                                onChange={(e) => updateIngredientRow(idx, "ingredientId", Number(e.target.value))}
                                style={styles.select}
                                required
                            >
                                <option value={0}>选择食材</option>
                                {ingredients.map((ing) => (
                                    <option key={ing.id} value={ing.id}>
                                        {ing.name} (¥{ing.unitPrice}/{ing.spec})
                                    </option>
                                ))}
                            </select>
                            <input
                                placeholder="用量"
                                type="number"
                                step="0.1"
                                min="0"
                                value={si.quantity}
                                onChange={(e) => updateIngredientRow(idx, "quantity", e.target.value)}
                                style={{ ...styles.input, width: 80 }}
                                required
                            />
                            <input
                                placeholder="单位"
                                value={si.unit}
                                onChange={(e) => updateIngredientRow(idx, "unit", e.target.value)}
                                style={{ ...styles.input, width: 60 }}
                                required
                            />
                            <button type="button" style={styles.removeBtn} onClick={() => removeIngredientRow(idx)}>
                                ✕
                            </button>
                        </div>
                    ))}
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
                        <strong>🔐 菜品分享码</strong>
                        <button style={styles.closeBtn} onClick={() => setShareCode("")}>✕</button>
                    </div>
                    <div style={styles.codeText}>{shareCode}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 5, textAlign: 'center' }}>
                        将分享码给朋友，在“发现”页与你共享美味。
                    </div>
                    <button
                        style={styles.copyBtn}
                        onClick={() => { navigator.clipboard.writeText(shareCode); alert("已复制！"); }}
                    >
                        📋 复制分享码
                    </button>
                </div>
            )}

            <div style={styles.dishGrid}>
                {dishes.length === 0 ? (
                    <div style={styles.empty}>暂无菜品</div>
                ) : (
                    dishes.map((dish) => (
                        <div key={dish.id} style={styles.dishCard}>
                            <div style={styles.dishHeader}>
                                <h3 style={{ margin: 0 }}>{dish.name}</h3>
                                <span style={styles.cost}>¥{dish.estimatedCost.toFixed(2)}</span>
                            </div>
                            <div style={styles.ingredientList}>
                                {dish.ingredients.map((di) => (
                                    <span key={di.id} style={styles.ingTag}>
                                        {di.ingredient.name} {di.quantity}{di.unit}
                                    </span>
                                ))}
                            </div>
                            <div style={styles.cardActions}>
                                <button style={styles.viewBtn} onClick={() => handleShare(dish.id)}>
                                    🔐 生成密语
                                </button>
                                <button style={styles.editBtn} onClick={() => handleEdit(dish)}>编辑</button>
                                <button style={styles.deleteBtn} onClick={() => handleDelete(dish.id)}>删除</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    addBtn: {
        padding: "8px 18px", border: "none", borderRadius: 8,
        backgroundColor: "#e67e22", color: "#fff", cursor: "pointer", fontSize: 14,
    },
    tip: {
        background: "#fff3cd", padding: "12px 16px", borderRadius: 8,
        marginBottom: 16, fontSize: 14, color: "#856404",
    },
    form: {
        background: "#fff", borderRadius: 10, padding: 20,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)", marginBottom: 20,
    },
    input: {
        padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14,
    },
    select: {
        flex: 1, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14,
    },
    sectionTitle: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#555",
    },
    smallBtn: {
        padding: "4px 10px", border: "1px solid #ddd", borderRadius: 4,
        background: "#fff", cursor: "pointer", fontSize: 12,
    },
    ingredientRow: { display: "flex", gap: 8, marginBottom: 8, alignItems: "center" },
    removeBtn: {
        padding: "4px 8px", border: "none", background: "transparent",
        color: "#e74c3c", cursor: "pointer", fontSize: 16,
    },
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
    dishGrid: {
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16, marginTop: 10,
    },
    dishCard: {
        background: "#fff", borderRadius: 10, padding: 20,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    },
    dishHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    cost: { color: "#e67e22", fontWeight: 700, fontSize: 18 },
    ingredientList: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 },
    ingTag: {
        background: "#f0f0f0", padding: "3px 10px", borderRadius: 12, fontSize: 12, color: "#555",
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
};
