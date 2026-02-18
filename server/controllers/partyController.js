const crypto = require('crypto');
const { Party, PartyDish, PartyGuest, Dish, DishIngredient, Ingredient, Menu, MenuDish } = require('../models');
const calculationEngine = require('../services/calculationEngine');

// 创建饭局
exports.create = async (req, res) => {
    try {
        const { name, menu_id } = req.body;
        if (!name) {
            return res.status(400).json({ message: '饭局名称不能为空' });
        }

        const share_code = crypto.randomBytes(3).toString('hex').toUpperCase();

        const party = await Party.create({
            host_id: req.user.id,
            name,
            share_code,
            status: 'active',
        });

        // 如果指定了菜单，预设菜品
        if (menu_id) {
            const menuDishes = await MenuDish.findAll({ where: { menu_id } });
            if (menuDishes.length > 0) {
                const partyDishes = menuDishes.map(md => ({
                    party_id: party.id,
                    dish_id: md.dish_id,
                    added_by: req.user.username,
                    servings: md.servings,
                }));
                await PartyDish.bulkCreate(partyDishes);
            }
        }

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
                    model: PartyDish,
                    as: 'partyDishes',
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
                    model: PartyDish,
                    as: 'partyDishes',
                    include: [{
                        model: Dish,
                        as: 'dish',
                        include: [{
                            model: DishIngredient,
                            as: 'dishIngredients',
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
        res.json({ party });
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
            party_id: party.id,
            nickname,
            guest_token,
        });
        res.status(201).json({ message: '加入成功', guest_token, guest });
    } catch (error) {
        console.error('加入饭局失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 往饭局添加菜品
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

        await PartyDish.create({
            party_id: party.id,
            dish_id,
            added_by: added_by || '匿名',
            servings: servings || 1,
        });

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
