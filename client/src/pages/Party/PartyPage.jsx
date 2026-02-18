import { useState, useEffect, useRef } from 'react';
import { Plus, Lock, Unlock, ShoppingCart, Copy, Users, X, Trash2, Minus, Edit3, Download, Image } from 'lucide-react';
import { partyAPI, dishAPI } from '../../services/api';
import { useToastStore } from '../../stores';
import html2canvas from 'html2canvas';

export default function PartyPage() {
    const [parties, setParties] = useState([]);
    const [allDishes, setAllDishes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState(null);
    const [showDetail, setShowDetail] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [showList, setShowList] = useState(false);
    const [listData, setListData] = useState(null);
    const [form, setForm] = useState({ name: '' });
    const [editForm, setEditForm] = useState({ name: '' });
    const [exporting, setExporting] = useState(false);
    const listRef = useRef(null);
    const showToast = useToastStore((s) => s.showToast);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [pRes, dRes] = await Promise.all([partyAPI.getMyParties(), dishAPI.getAll()]);
            setParties(pRes.data.parties);
            setAllDishes(dRes.data.dishes);
        } catch (err) { showToast('获取数据失败', 'error'); }
        finally { setLoading(false); }
    };

    /* ── 饭局 CRUD ── */
    const handleCreate = async () => {
        if (!form.name.trim()) { showToast('请输入饭局名称', 'error'); return; }
        try {
            await partyAPI.create(form);
            showToast('饭局创建成功 🎉', 'success');
            setShowCreate(false); setForm({ name: '' }); fetchData();
        } catch (err) { showToast('创建失败', 'error'); }
    };

    const handleUpdate = async (id) => {
        if (!editForm.name.trim()) { showToast('名称不能为空', 'error'); return; }
        try {
            await partyAPI.update(id, { name: editForm.name });
            showToast('更新成功', 'success');
            setShowEdit(null); fetchData();
            if (showDetail && detailData) {
                setDetailData({ ...detailData, name: editForm.name });
            }
        } catch (err) { showToast('更新失败', 'error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('确定要删除这个饭局吗？')) return;
        try {
            await partyAPI.delete(id);
            showToast('已删除', 'success');
            fetchData();
        } catch (err) { showToast('删除失败', 'error'); }
    };

    const handleToggle = async (id, shareCode) => {
        try {
            await partyAPI.toggleLock(id);
            showToast('状态已切换', 'success');
            fetchData();
            if (showDetail) viewDetail(showDetail);
        } catch (err) { showToast('操作失败', 'error'); }
    };

    /* ── 饭局详情 ── */
    const viewDetail = async (code) => {
        try {
            const res = await partyAPI.getByShareCode(code);
            setDetailData(res.data.party);
            setShowDetail(code);
        } catch (err) { showToast('获取详情失败', 'error'); }
    };

    /* ── 菜品管理 ── */
    const handleAddDish = async (code, dishId, dishName) => {
        try {
            await partyAPI.addDish(code, { dish_id: dishId, added_by: '主人', servings: 1 });
            showToast(`已添加 ${dishName}`, 'success');
            viewDetail(code);
            fetchData(); // 同步列表预算
        } catch (err) { showToast(err.response?.data?.message || '添加失败', 'error'); }
    };

    const handleRemoveDish = async (partyDishId) => {
        try {
            await partyAPI.removeDish(partyDishId);
            showToast('已移除', 'success');
            viewDetail(showDetail);
            fetchData();
        } catch (err) { showToast(err.response?.data?.message || '移除失败', 'error'); }
    };

    const handleChangeServings = async (partyDishId, servings) => {
        if (servings < 1) return;
        try {
            await partyAPI.updateDishServings(partyDishId, servings);
            viewDetail(showDetail);
            fetchData();
        } catch (err) { showToast('修改失败', 'error'); }
    };

    /* ── 采购清单 ── */
    const viewShoppingList = async (code) => {
        try {
            const res = await partyAPI.getShoppingList(code);
            setListData(res.data);
            setShowList(true);
        } catch (err) { showToast('生成清单失败', 'error'); }
    };

    const exportListAsImage = async () => {
        if (!listRef.current || exporting) return;
        setExporting(true);
        try {
            const canvas = await html2canvas(listRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
            });
            const link = document.createElement('a');
            link.download = `${listData?.party_name || '饭局'}_采购清单.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            showToast('图片已保存 📷', 'success');
        } catch (err) {
            showToast('导出失败', 'error');
        }
        setExporting(false);
    };

    /* ── 复制分享码 ── */
    const copyCode = (code) => {
        navigator.clipboard?.writeText(code);
        showToast(`分享码 ${code} 已复制`, 'success');
    };

    return (
        <>
            <header className="page-header">
                <h1>🍻 饭局</h1>
                <button className="page-header__action" onClick={() => setShowCreate(true)}>
                    <Plus size={24} />
                </button>
            </header>
            <div className="page-container">
                {loading ? (
                    <div className="card-list">{[1, 2].map(i => <div key={i} className="skeleton skeleton--card" />)}</div>
                ) : parties.length === 0 ? (
                    <div className="empty-state">
                        <Users className="empty-state__icon" size={80} />
                        <div className="empty-state__title">还没有饭局</div>
                        <div className="empty-state__text">点击右上角发起一个饭局吧</div>
                    </div>
                ) : (
                    <div className="card-list">
                        {parties.map((p, i) => (
                            <div key={p.id} className="card animate-card-enter" style={{ animationDelay: `${i * 60}ms` }}>
                                <div className="card__body">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <div className="card__title">{p.name}</div>
                                            <div className="card__meta">
                                                <span className={`card__badge ${p.status === 'active' ? 'card__badge--success' : 'card__badge--primary'}`}>
                                                    {p.status === 'active' ? '进行中' : '已锁定'}
                                                </span>
                                                <span className="text-sm text-secondary">{(p.guests || []).length} 人</span>
                                                <span className="text-sm text-secondary">{(p.partyDishes || []).length} 道菜</span>
                                            </div>
                                        </div>
                                        <div className="card__price">¥{Number(p.total_budget || 0).toFixed(2)}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
                                        <button className="btn btn--sm btn--primary" onClick={() => viewDetail(p.share_code)}>查看详情</button>
                                        <button className="btn btn--sm btn--secondary" onClick={() => copyCode(p.share_code)}><Copy size={14} /> {p.share_code}</button>
                                        <button className="btn btn--sm btn--secondary" onClick={() => viewShoppingList(p.share_code)}><ShoppingCart size={14} /> 清单</button>
                                        <button className="btn btn--sm btn--secondary" onClick={() => handleToggle(p.id, p.share_code)}>
                                            {p.status === 'active' ? <Lock size={14} /> : <Unlock size={14} />}
                                        </button>
                                        <button className="btn btn--sm btn--secondary" onClick={() => { setShowEdit(p.id); setEditForm({ name: p.name }); }}><Edit3 size={14} /></button>
                                        <button className="btn btn--sm btn--secondary" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── 创建弹窗 ── */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-handle" />
                        <div className="modal-header">
                            <h2>发起饭局</h2>
                            <button className="page-header__action" onClick={() => setShowCreate(false)}><X size={22} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">饭局名称</label>
                                <input className="form-input" placeholder="如：周五火锅局" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn--primary btn--block" onClick={handleCreate}>创建饭局</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 编辑弹窗 ── */}
            {showEdit && (
                <div className="modal-overlay" onClick={() => setShowEdit(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-handle" />
                        <div className="modal-header">
                            <h2>编辑饭局</h2>
                            <button className="page-header__action" onClick={() => setShowEdit(null)}><X size={22} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">饭局名称</label>
                                <input className="form-input" value={editForm.name} onChange={e => setEditForm({ name: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn--primary btn--block" onClick={() => handleUpdate(showEdit)}>保存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 详情弹窗（含菜品管理） ── */}
            {showDetail && detailData && (
                <div className="modal-overlay" onClick={() => setShowDetail(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
                        <div className="modal-handle" />
                        <div className="modal-header">
                            <h2>{detailData.name}</h2>
                            <button className="page-header__action" onClick={() => setShowDetail(null)}><X size={22} /></button>
                        </div>
                        <div className="modal-body">
                            {/* 预算总览 */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: 'var(--space-md)', background: 'var(--color-primary-alpha)',
                                borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)'
                            }}>
                                <span style={{ fontWeight: 600 }}>预估总价</span>
                                <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--font-size-xl)' }}>
                                    ¥{Number(detailData.total_budget || 0).toFixed(2)}
                                </span>
                            </div>

                            {/* 已点菜品列表 */}
                            <div className="form-label">已点菜品 ({(detailData.partyDishes || []).length})</div>
                            {(detailData.partyDishes || []).length === 0 ? (
                                <div style={{ padding: 'var(--space-lg) 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>还没有菜品，点击下方添加</div>
                            ) : (
                                (detailData.partyDishes || []).map((pd) => (
                                    <div key={pd.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border-light)'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500 }}>{pd.dish?.name || '未知菜品'}</div>
                                            <div className="text-sm text-secondary">by {pd.added_by}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                            {/* 份数调整 */}
                                            {detailData.status === 'active' && (
                                                <>
                                                    <button className="btn btn--sm btn--secondary" style={{ padding: '4px 8px', minWidth: 'auto' }}
                                                        onClick={() => handleChangeServings(pd.id, pd.servings - 1)} disabled={pd.servings <= 1}>
                                                        <Minus size={14} />
                                                    </button>
                                                    <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>{pd.servings}</span>
                                                    <button className="btn btn--sm btn--secondary" style={{ padding: '4px 8px', minWidth: 'auto' }}
                                                        onClick={() => handleChangeServings(pd.id, pd.servings + 1)}>
                                                        <Plus size={14} />
                                                    </button>
                                                    <button className="btn btn--sm btn--secondary"
                                                        style={{ padding: '4px 8px', minWidth: 'auto', color: 'var(--color-danger)', marginLeft: 4 }}
                                                        onClick={() => handleRemoveDish(pd.id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                            {detailData.status !== 'active' && (
                                                <span style={{ fontWeight: 600 }}>× {pd.servings}</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* 添加菜品 */}
                            {detailData.status === 'active' && (
                                <div style={{ marginTop: 'var(--space-lg)' }}>
                                    <div className="form-label">添加菜品</div>
                                    {allDishes.length === 0 ? (
                                        <div className="text-sm text-secondary">请先在"菜品"页面创建菜品</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                                            {allDishes.map(d => (
                                                <button key={d.id} className="btn btn--sm btn--secondary" onClick={() => handleAddDish(showDetail, d.id, d.name)}>
                                                    <Plus size={14} /> {d.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── 采购清单弹窗（支持导出图片） ── */}
            {showList && listData && (
                <div className="modal-overlay" onClick={() => setShowList(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-handle" />
                        <div className="modal-header">
                            <h2>📝 采购清单</h2>
                            <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                                <button className="btn btn--sm btn--primary" onClick={exportListAsImage} disabled={exporting}>
                                    <Image size={14} /> {exporting ? '导出中...' : '导出图片'}
                                </button>
                                <button className="page-header__action" onClick={() => setShowList(false)}><X size={22} /></button>
                            </div>
                        </div>
                        <div className="modal-body">
                            {/* 可导出区域 */}
                            <div ref={listRef} style={{ padding: 'var(--space-md)', background: '#fff' }}>
                                <div style={{
                                    textAlign: 'center', fontSize: 'var(--font-size-xl)', fontWeight: 700,
                                    marginBottom: 'var(--space-sm)', color: '#1a1a2e'
                                }}>
                                    🛒 {listData.party_name}
                                </div>
                                <div style={{
                                    textAlign: 'center', fontSize: 'var(--font-size-sm)',
                                    marginBottom: 'var(--space-md)', color: '#666'
                                }}>
                                    采购清单 · {new Date().toLocaleDateString('zh-CN')}
                                </div>

                                {/* 表头 */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                                    background: '#f0f0f5', borderRadius: '8px 8px 0 0', fontWeight: 600, fontSize: 13, color: '#555'
                                }}>
                                    <span style={{ flex: 1 }}>食材</span>
                                    <span style={{ width: 80, textAlign: 'right' }}>数量</span>
                                    <span style={{ width: 80, textAlign: 'right' }}>金额</span>
                                </div>

                                {(listData.shopping_list?.ingredients || []).map((ing, i) => (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: 14
                                    }}>
                                        <span style={{ flex: 1, color: '#333' }}>{ing.name}</span>
                                        <span style={{ width: 80, textAlign: 'right', color: '#555' }}>{ing.total_quantity}{ing.unit}</span>
                                        <span style={{ width: 80, textAlign: 'right', color: '#e74c3c', fontWeight: 600 }}>¥{Number(ing.total_price).toFixed(2)}</span>
                                    </div>
                                ))}

                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', padding: '14px 12px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    borderRadius: '0 0 8px 8px', fontWeight: 700, fontSize: 16, color: '#fff',
                                    marginTop: 0
                                }}>
                                    <span>总计</span>
                                    <span>¥{Number(listData.shopping_list?.grand_total || 0).toFixed(2)}</span>
                                </div>

                                <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#aaa' }}>
                                    旺财厨房 WoWoKitchen
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
