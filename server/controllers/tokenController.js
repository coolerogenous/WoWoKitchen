const crypto = require('crypto');
const { Token, Dish, DishIngredient, Ingredient, Menu, MenuDish } = require('../models');

// 根据内容生成确定性的密语码（同一内容始终生成同一码）
function generateDeterministicCode(type, data) {
    const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return (type.charAt(0).toUpperCase() + hash.substring(0, 7)).toUpperCase();
}

// 生成密语 - 导出菜品
exports.exportDish = async (req, res) => {
    try {
        const dish = await Dish.findOne({
            where: { id: req.params.id, user_id: req.user.id },
            include: [{
                model: DishIngredient,
                as: 'dishIngredients',
                include: [{ model: Ingredient, as: 'ingredient' }],
            }],
        });
        if (!dish) {
            return res.status(404).json({ message: '菜品不存在' });
        }

        const data = {
            dish: {
                name: dish.name,
                description: dish.description,
                ingredients: dish.dishIngredients.map(di => ({
                    name: di.ingredient.name,
                    unit_price: di.ingredient.unit_price,
                    unit_spec: di.ingredient.unit_spec,
                    unit: di.ingredient.unit,
                    quantity: di.quantity,
                    di_unit: di.unit,
                })),
            },
        };

        const code = generateDeterministicCode('D', data);

        // 查找是否已有同码的 token，有则更新数据，无则创建
        const existing = await Token.findOne({ where: { code } });
        if (existing) {
            await existing.update({ data: JSON.stringify(data) });
        } else {
            await Token.create({
                user_id: req.user.id,
                code,
                type: 'dish',
                data: JSON.stringify(data),
            });
        }

        res.json({ message: '密语生成成功', code });
    } catch (error) {
        console.error('导出菜品失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 生成密语 - 导出菜单
exports.exportMenu = async (req, res) => {
    try {
        const menu = await Menu.findOne({
            where: { id: req.params.id, user_id: req.user.id },
            include: [{
                model: MenuDish,
                as: 'menuDishes',
                include: [{
                    model: Dish,
                    as: 'dish',
                    include: [{
                        model: DishIngredient,
                        as: 'dishIngredients',
                        include: [{ model: Ingredient, as: 'ingredient' }],
                    }],
                }],
            }],
        });
        if (!menu) {
            return res.status(404).json({ message: '菜单不存在' });
        }

        const data = {
            menu: {
                name: menu.name,
                description: menu.description,
                dishes: menu.menuDishes.map(md => ({
                    name: md.dish.name,
                    description: md.dish.description,
                    servings: md.servings,
                    ingredients: md.dish.dishIngredients.map(di => ({
                        name: di.ingredient.name,
                        unit_price: di.ingredient.unit_price,
                        unit_spec: di.ingredient.unit_spec,
                        unit: di.ingredient.unit,
                        quantity: di.quantity,
                        di_unit: di.unit,
                    })),
                })),
            },
        };

        const code = generateDeterministicCode('M', data);

        const existing = await Token.findOne({ where: { code } });
        if (existing) {
            await existing.update({ data: JSON.stringify(data) });
        } else {
            await Token.create({
                user_id: req.user.id,
                code,
                type: 'menu',
                data: JSON.stringify(data),
            });
        }

        res.json({ message: '密语生成成功', code });
    } catch (error) {
        console.error('导出菜单失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 通过密语导入
exports.importByCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ message: '请输入密语' });
        }

        const token = await Token.findOne({ where: { code: code.toUpperCase() } });
        if (!token) {
            return res.status(404).json({ message: '密语无效或已过期' });
        }

        const data = JSON.parse(token.data);
        const userId = req.user.id;

        if (token.type === 'dish') {
            await importDishData(userId, data.dish);
            res.json({ message: '菜品导入成功' });
        } else if (token.type === 'menu') {
            await importMenuData(userId, data.menu);
            res.json({ message: '菜单导入成功' });
        }
    } catch (error) {
        console.error('导入失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 导入菜品数据（含去重）
async function importDishData(userId, dishData) {
    const ingredientMap = {};

    for (const ing of dishData.ingredients) {
        let localIng = await Ingredient.findOne({
            where: { user_id: userId, name: ing.name },
        });
        if (!localIng) {
            localIng = await Ingredient.create({
                user_id: userId,
                name: ing.name,
                unit_price: ing.unit_price,
                unit_spec: ing.unit_spec,
                unit: ing.unit,
            });
        }
        ingredientMap[ing.name] = localIng.id;
    }

    const dish = await Dish.create({
        user_id: userId,
        name: dishData.name,
        description: dishData.description || '',
    });

    const dishIngredients = dishData.ingredients.map(ing => ({
        dish_id: dish.id,
        ingredient_id: ingredientMap[ing.name],
        quantity: ing.quantity,
        unit: ing.di_unit || ing.unit,
    }));
    await DishIngredient.bulkCreate(dishIngredients);

    const calculationEngine = require('../services/calculationEngine');
    const cost = await calculationEngine.calculateDishCost(dish.id);
    await dish.update({ estimated_cost: cost });

    return dish;
}

// 导入菜单数据
async function importMenuData(userId, menuData) {
    const dishIds = [];

    for (const dishData of menuData.dishes) {
        const dish = await importDishData(userId, dishData);
        dishIds.push({ dish_id: dish.id, servings: dishData.servings || 1 });
    }

    const menu = await Menu.create({
        user_id: userId,
        name: menuData.name,
        description: menuData.description || '',
    });

    const menuDishes = dishIds.map(item => ({
        menu_id: menu.id,
        dish_id: item.dish_id,
        servings: item.servings,
    }));
    await MenuDish.bulkCreate(menuDishes);

    const calculationEngine = require('../services/calculationEngine');
    const cost = await calculationEngine.calculateMenuCost(menu.id);
    await menu.update({ total_cost: cost });

    return menu;
}
