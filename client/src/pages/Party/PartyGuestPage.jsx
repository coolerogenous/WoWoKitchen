import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, ShoppingCart, X, Image, Minus } from 'lucide-react';
import html2canvas from 'html2canvas';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function apiFetch(url, options = {}) {
    const res = await fetch(API_BASE + url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '请求失败');
    return data;
}

export default function PartyGuestPage() {
    const { code } = useParams();
    const [party, setParty] = useState(null);
    const [availableDishes, setAvailableDishes] = useState([]);
    const [error, setError] = useState('');
    const [nickname, setNickname] = useState('');
    const [joined, setJoined] = useState(false);
    const [guestToken, setGuestToken] = useState('');
    const [showList, setShowList] = useState(false);
    const [listData, setListData] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [toast, setToast] = useState('');
    const listRef = useRef(null);

    useEffect(() => {
        if (code) fetchParty();
        const savedToken = localStorage.getItem(`wk_guest_${code}`);
        const savedName = localStorage.getItem(`wk_guest_name_${code}`);
        if (savedToken) {
            setGuestToken(savedToken);
            setNickname(savedName || '游客');
            setJoined(true);
        }
    }, [code]);

    const showToastMsg = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

    const fetchParty = async () => {
        try {
            const data = await apiFetch(`/parties/join/${code}`);
            setParty(data.party);
            setAvailableDishes(data.availableDishes || []);
        } catch (err) { setError(err.message); }
    };

    const handleJoin = async () => {
        if (!nickname.trim()) { showToastMsg('请输入你的昵称'); return; }
        try {
            const data = await apiFetch(`/parties/join/${code}/guest`, {
                method: 'POST', body: JSON.stringify({ nickname: nickname.trim() }),
            });
            setGuestToken(data.guest_token);
            setJoined(true);
            localStorage.setItem(`wk_guest_${code}`, data.guest_token);
            localStorage.setItem(`wk_guest_name_${code}`, nickname.trim());
            showToastMsg('加入成功 🎉');
            fetchParty();
        } catch (err) { showToastMsg(err.message); }
    };

    // 点菜（同一道菜后端会自动累加份数）
    const handleAddDish = async (dishId, dishName) => {
        try {
            await apiFetch(`/parties/join/${code}/add-dish`, {
                method: 'POST',
                body: JSON.stringify({ dish_id: dishId, added_by: nickname || '游客', servings: 1 }),
            });
            showToastMsg(`${dishName} +1`);
            fetchParty();
        } catch (err) { showToastMsg(err.message); }
    };

    // 删除菜品
    const handleRemoveDish = async (partyDishId) => {
        try {
            await apiFetch(`/parties/join/${code}/dish/${partyDishId}`, { method: 'DELETE' });
            showToastMsg('已移除');
            fetchParty();
        } catch (err) { showToastMsg(err.message); }
    };

    // 修改份数
    const handleChangeServings = async (partyDishId, newServings) => {
        if (newServings < 1) {
            handleRemoveDish(partyDishId);
            return;
        }
        try {
            await apiFetch(`/parties/join/${code}/dish/${partyDishId}/servings`, {
                method: 'PUT',
                body: JSON.stringify({ servings: newServings }),
            });
            fetchParty();
        } catch (err) { showToastMsg(err.message); }
    };

    const viewShoppingList = async () => {
        try {
            const data = await apiFetch(`/parties/join/${code}/shopping-list`);
            setListData(data); setShowList(true);
        } catch (err) { showToastMsg('获取清单失败'); }
    };

    const exportImage = async () => {
        if (!listRef.current || exporting) return;
        setExporting(true);
        try {
            const canvas = await html2canvas(listRef.current, { backgroundColor: '#fff', scale: 2 });
            const link = document.createElement('a');
            link.download = `${party?.name || '饭局'}_采购清单.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            showToastMsg('图片已保存 📷');
        } catch { showToastMsg('导出失败'); }
        setExporting(false);
    };

    if (error) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 24 }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 360, width: '100%' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>😢</div>
                    <h2 style={{ color: '#333', marginBottom: 8 }}>饭局不存在</h2>
                    <p style={{ color: '#888' }}>{error}</p>
                </div>
            </div>
        );
    }

    if (!party) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <div style={{ color: '#fff', fontSize: 18 }}>加载中...</div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5fa' }}>
            {/* 顶部 Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '36px 20px 28px', color: '#fff', textAlign: 'center',
            }}>
                <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 4 }}>🍻 你被邀请加入</div>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{party.name}</h1>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
                    {party.status === 'locked' ? '🔒 已锁定' : '🟢 进行中'}
                    {' · '}{(party.guests || []).length} 人参与
                </div>
            </div>

            <div style={{ maxWidth: 500, margin: '0 auto', padding: '20px 16px' }}>

                {/* 加入区 */}
                {!joined && party.status === 'active' && (
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 12 }}>输入昵称加入饭局</div>
                        <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="你的昵称"
                            style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 16, marginBottom: 12, boxSizing: 'border-box' }} />
                        <button onClick={handleJoin} style={{
                            width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer'
                        }}>加入饭局</button>
                    </div>
                )}

                {/* 已点菜品列表（合并展示） */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 16 }}>🍽️ 已选菜品 ({(party.partyDishes || []).length})</div>
                        <div style={{ fontWeight: 700, color: '#667eea', fontSize: 18 }}>¥{Number(party.total_budget || 0).toFixed(2)}</div>
                    </div>
                    {(party.partyDishes || []).length === 0 ? (
                        <div style={{ padding: '20px 0', textAlign: 'center', color: '#aaa' }}>还没有人点菜</div>
                    ) : (
                        (party.partyDishes || []).map(pd => (
                            <div key={pd.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 0', borderBottom: '1px solid #f0f0f0'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 500 }}>{pd.dish?.name}</div>
                                    <div style={{ fontSize: 12, color: '#999' }}>by {pd.added_by}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {joined && party.status === 'active' ? (
                                        <>
                                            <button onClick={() => handleChangeServings(pd.id, pd.servings - 1)}
                                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Minus size={14} color="#888" />
                                            </button>
                                            <span style={{ fontWeight: 600, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{pd.servings}</span>
                                            <button onClick={() => handleChangeServings(pd.id, pd.servings + 1)}
                                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Plus size={14} color="#667eea" />
                                            </button>
                                            <button onClick={() => handleRemoveDish(pd.id)}
                                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fdd', background: '#fff5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
                                                <X size={14} color="#e74c3c" />
                                            </button>
                                        </>
                                    ) : (
                                        <span style={{ fontWeight: 600, fontSize: 16 }}>× {pd.servings}</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 点菜区（只显示可选范围内的菜品 + 需先加入） */}
                {joined && party.status === 'active' && availableDishes.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 12 }}>➕ 点菜</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {availableDishes.map(d => (
                                <button key={d.id} onClick={() => handleAddDish(d.id, d.name)} style={{
                                    padding: '10px 16px', borderRadius: 10, border: '1px solid #e0e0e0',
                                    background: '#fafafa', cursor: 'pointer', fontSize: 14,
                                    display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
                                    transition: 'all 0.15s ease',
                                }}>
                                    <Plus size={16} color="#667eea" /> {d.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 查看采购清单 */}
                <button onClick={viewShoppingList} style={{
                    width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                    background: '#fff', color: '#667eea', fontSize: 16, fontWeight: 600,
                    cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                    <ShoppingCart size={18} /> 查看采购清单
                </button>
            </div>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                    background: '#333', color: '#fff', padding: '10px 24px', borderRadius: 20,
                    fontSize: 14, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}>{toast}</div>
            )}

            {/* 采购清单弹窗 */}
            {showList && listData && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
                }} onClick={() => setShowList(false)}>
                    <div style={{
                        background: '#fff', borderRadius: '16px 16px 0 0', maxWidth: 500, width: '100%',
                        maxHeight: '80vh', overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '16px 20px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, background: '#fff', zIndex: 1
                        }}>
                            <h3 style={{ margin: 0 }}>📝 采购清单</h3>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button onClick={exportImage} disabled={exporting} style={{
                                    padding: '6px 14px', borderRadius: 8, border: 'none',
                                    background: '#667eea', color: '#fff', fontSize: 13, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600
                                }}><Image size={14} /> {exporting ? '...' : '导出图片'}</button>
                                <button onClick={() => setShowList(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                    <X size={22} color="#888" />
                                </button>
                            </div>
                        </div>
                        <div style={{ padding: 20 }}>
                            <div ref={listRef} style={{ padding: 16, background: '#fff' }}>
                                <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#1a1a2e' }}>🛒 {listData.party_name}</div>
                                <div style={{ textAlign: 'center', fontSize: 13, marginBottom: 16, color: '#666' }}>采购清单 · {new Date().toLocaleDateString('zh-CN')}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f0f0f5', borderRadius: '8px 8px 0 0', fontWeight: 600, fontSize: 13, color: '#555' }}>
                                    <span style={{ flex: 1 }}>食材</span><span style={{ width: 80, textAlign: 'right' }}>数量</span><span style={{ width: 80, textAlign: 'right' }}>金额</span>
                                </div>
                                {(listData.shopping_list?.ingredients || []).map((ing, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: 14 }}>
                                        <span style={{ flex: 1, color: '#333' }}>{ing.name}</span>
                                        <span style={{ width: 80, textAlign: 'right', color: '#555' }}>{ing.total_quantity}{ing.unit}</span>
                                        <span style={{ width: 80, textAlign: 'right', color: '#e74c3c', fontWeight: 600 }}>¥{Number(ing.total_price).toFixed(2)}</span>
                                    </div>
                                ))}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', padding: '14px 12px',
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    borderRadius: '0 0 8px 8px', fontWeight: 700, fontSize: 16, color: '#fff'
                                }}><span>总计</span><span>¥{Number(listData.shopping_list?.grand_total || 0).toFixed(2)}</span></div>
                                <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#aaa' }}>旺财厨房 WoWoKitchen</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
