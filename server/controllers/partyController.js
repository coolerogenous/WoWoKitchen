const crypto = require('crypto');
const { Party, PartyDish, PartyGuest, Dish, DishIngredient, Ingredient, Menu, MenuDish } = require('../models');
const calculationEngine = require('../services/calculationEngine');

// 创建饭局
exports.create = async (req, res) => {
    try {
        const { name, menu_id, dish_ids } = req.body;
        if (!name) {
            return res.status(400).json({ message: '饭局名称不能为空' });
        }

        const share_code = crypto.randomBytes(3).toString('hex').toUpperCase();

        // 收集可点菜品 ID
        let availableDishIds = [];

        if (menu_id) {
            // 从菜单获取菜品
            const menuDishes = await MenuDish.findAll({ where: { menu_id } });
            availableDishIds = menuDishes.map(md => md.dish_id);
        }

        if (dish_ids && Array.isArray(dish_ids) && dish_ids.length > 0) {
            // 合并手动选择的菜品 ID（去重）
            const merged = new Set([...availableDishIds, ...dish_ids]);
            availableDishIds = [...merged];
        }

        const party = await Party.create({
            host_id: req.user.id,
            name,
            share_code,
            status: 'active',
            available_dish_ids: availableDishIds.length > 0 ? availableDishIds : null,
        });

        const budget = await calculationEngine.calculatePartyBudget(party.id);
        await party.update({ total_budget: budget });

        res.status(201).json({ message: '饭局创建成功', party, share_code });
    } catch (error) {
        console.error('创建饭局失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取我发起的饭局列表
exports.getMyParties = async (req, res) => {
    try {
        const parties = await Party.findAll({
            where: { host_id: req.user.id },
            include: [
                { model: PartyGuest, as: 'guests' },
                {
                    model: PartyDish, as: 'partyDishes',
                    include: [{ model: Dish, as: 'dish' }],
                },
            ],
            order: [['created_at', 'DESC']],
        });
        res.json({ parties });
    } catch (error) {
        console.error('获取饭局列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新饭局信息
exports.update = async (req, res) => {
    try {
        const party = await Party.findOne({
            where: { id: req.params.id, host_id: req.user.id },
        });
        if (!party) {
            return res.status(404).json({ message: '饭局不存在或无权操作' });
        }
        const { name } = req.body;
        if (name) await party.update({ name });
        res.json({ message: '更新成功', party });
    } catch (error) {
        console.error('更新饭局失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除饭局
exports.delete = async (req, res) => {
    try {
        const party = await Party.findOne({
            where: { id: req.params.id, host_id: req.user.id },
        });
        if (!party) {
            return res.status(404).json({ message: '饭局不存在或无权操作' });
        }
        await PartyDish.destroy({ where: { party_id: party.id } });
        await PartyGuest.destroy({ where: { party_id: party.id } });
        await party.destroy();
        res.json({ message: '饭局已删除' });
    } catch (error) {
        console.error('删除饭局失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取饭局详情（通过分享码，游客可访问）
exports.getByShareCode = async (req, res) => {
    try {
        const party = await Party.findOne({
            where: { share_code: req.params.code },
            include: [
                {
                    model: PartyDish, as: 'partyDishes',
                    include: [{
                        model: Dish, as: 'dish',
                        include: [{
                            model: DishIngredient, as: 'dishIngredients',
                            include: [{ model: Ingredient, as: 'ingredient' }],
                        }],
                    }],
                },
                { model: PartyGuest, as: 'guests' },
            ],
        });
        if (!party) {
            return res.status(404).json({ message: '饭局不存在' });
        }

        // 如果有 available_dish_ids，拉取可点菜品的完整信息
        let availableDishes = [];
        if (party.available_dish_ids && party.available_dish_ids.length > 0) {
            availableDishes = await Dish.findAll({
                where: { id: party.available_dish_ids },
                attributes: ['id', 'name', 'estimated_cost'],
            });
        }

        res.json({ party, availableDishes });
    } catch (error) {
        console.error('获取饭局详情失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 游客加入饭局
exports.joinAsGuest = async (req, res) => {
    try {
        const { nickname } = req.body;
        if (!nickname) {
            return res.status(400).json({ message: '请输入昵称' });
        }
        const party = await Party.findOne({ where: { share_code: req.params.code } });
        if (!party) {
            return res.status(404).json({ message: '饭局不存在' });
        }
        if (party.status === 'locked') {
            return res.status(403).json({ message: '饭局已锁定，无法加入' });
        }
        const guest_token = crypto.randomBytes(16).toString('hex');
        const guest = await PartyGuest.create({
            party_id: party.id, nickname, guest_token,
        });
        res.status(201).json({ message: '加入成功', guest_token, guest });
    } catch (error) {
        console.error('加入饭局失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 往饭局添加菜品（同一道菜累加份数）
exports.addDish = async (req, res) => {
    try {
        const { dish_id, added_by, servings } = req.body;
        const party = await Party.findOne({ where: { share_code: req.params.code } });
        if (!party) {
            return res.status(404).json({ message: '饭局不存在' });
        }
        if (party.status === 'locked') {
            return res.status(403).json({ message: '饭局已锁定，无法修改' });
        }

        // 检查是否在可选菜品范围内
        if (party.available_dish_ids && party.available_dish_ids.length > 0) {
            if (!party.available_dish_ids.includes(dish_id)) {
                return res.status(400).json({ message: '该菜品不在可选范围内' });
            }
        }

        // 查找是否已有同一道菜，有则累加份数
        const existing = await PartyDish.findOne({
            where: { party_id: party.id, dish_id },
        });

        if (existing) {
            await existing.update({ servings: existing.servings + (parseInt(servings) || 1) });
        } else {
            await PartyDish.create({
                party_id: party.id,
                dish_id,
                added_by: added_by || '匿名',
                servings: parseInt(servings) || 1,
            });
        }

        const budget = await calculationEngine.calculatePartyBudget(party.id);
        await party.update({ total_budget: budget });

        res.status(201).json({ message: '菜品已添加', total_budget: budget });
    } catch (error) {
        console.error('添加菜品失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除饭局中的菜品
exports.removeDish = async (req, res) => {
    try {
        const partyDish = await PartyDish.findByPk(req.params.dishId);
        if (!partyDish) {
            return res.status(404).json({ message: '菜品记录不存在' });
        }
        const party = await Party.findByPk(partyDish.party_id);
        if (!party) {
            return res.status(404).json({ message: '饭局不存在' });
        }
        if (party.status === 'locked') {
            return res.status(403).json({ message: '饭局已锁定，无法修改' });
        }
        await partyDish.destroy();

        const budget = await calculationEngine.calculatePartyBudget(party.id);
        await party.update({ total_budget: budget });
        res.json({ message: '菜品已移除', total_budget: budget });
    } catch (error) {
        console.error('移除菜品失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 修改饭局中菜品的份数
exports.updateDishServings = async (req, res) => {
    try {
        const { servings } = req.body;
        const partyDish = await PartyDish.findByPk(req.params.dishId);
        if (!partyDish) {
            return res.status(404).json({ message: '菜品记录不存在' });
        }
        const party = await Party.findByPk(partyDish.party_id);
        if (!party) {
            return res.status(404).json({ message: '饭局不存在' });
        }
        if (party.status === 'locked') {
            return res.status(403).json({ message: '饭局已锁定，无法修改' });
        }
        await partyDish.update({ servings: parseInt(servings) || 1 });

        const budget = await calculationEngine.calculatePartyBudget(party.id);
        await party.update({ total_budget: budget });
        res.json({ message: '份数已更新', total_budget: budget });
    } catch (error) {
        console.error('修改份数失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 锁定/解锁饭局
exports.toggleLock = async (req, res) => {
    try {
        const party = await Party.findOne({
            where: { id: req.params.id, host_id: req.user.id },
        });
        if (!party) {
            return res.status(404).json({ message: '饭局不存在或无权操作' });
        }
        const newStatus = party.status === 'active' ? 'locked' : 'active';
        await party.update({ status: newStatus });
        res.json({ message: newStatus === 'locked' ? '饭局已锁定' : '饭局已解锁', status: newStatus });
    } catch (error) {
        console.error('切换饭局状态失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取饭局采购清单
exports.getShoppingList = async (req, res) => {
    try {
        const party = await Party.findOne({ where: { share_code: req.params.code } });
        if (!party) {
            return res.status(404).json({ message: '饭局不存在' });
        }
        const shoppingList = await calculationEngine.generatePartyShoppingList(party.id);
        res.json({ party_name: party.name, status: party.status, shopping_list: shoppingList });
    } catch (error) {
        console.error('生成采购清单失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};
