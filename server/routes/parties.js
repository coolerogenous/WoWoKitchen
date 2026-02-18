const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');
const { auth, optionalAuth } = require('../middleware/auth');

// 需要登录的操作
router.post('/', auth, partyController.create);
router.get('/my', auth, partyController.getMyParties);
router.put('/:id', auth, partyController.update);
router.delete('/:id', auth, partyController.delete);
router.put('/:id/toggle-lock', auth, partyController.toggleLock);

// 饭局内菜品管理
router.delete('/dish/:dishId', auth, partyController.removeDish);
router.put('/dish/:dishId/servings', auth, partyController.updateDishServings);

// 游客也可以访问的操作
router.get('/join/:code', optionalAuth, partyController.getByShareCode);
router.post('/join/:code/guest', partyController.joinAsGuest);
router.post('/join/:code/add-dish', optionalAuth, partyController.addDish);
router.get('/join/:code/shopping-list', optionalAuth, partyController.getShoppingList);

module.exports = router;
