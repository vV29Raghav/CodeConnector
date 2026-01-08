const express = require('express');
const router = express.Router();
const codeController = require('../controllers/codeController');

router.post('/run-code', codeController.executeCode);

module.exports = router;
