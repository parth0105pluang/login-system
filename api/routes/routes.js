const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user_controller.js');
var key = "2e35f242a46d67eeb74aabc37d5e5d05";
router.get('/data/:login_method',UserController.logInMiddwre,UserController.dispData);
router.post('/signup/mail', UserController.signupMail);
router.post('/signup/mobile', UserController.signupMobile);
//router.post('/login/:verification_method', UserController.login);
router.post('/login/mail', UserController.loginMail);
router.post('/login/mobile', UserController.loginMobile);
router.post('/getotp', UserController.getotp);
router.get('/verify/:token/:user_varification_type', UserController.verify);
router.get('/reset/:token/:Password',UserController.reset);
router.post('/forgotpassword/mail',UserController.forgotpasswordMail);
router.post('/login/otp',UserController.loginotp);
router.post('/forgotpassword/mobile',UserController.forgotpasswordMobile);
router.put('/update/:login_method',UserController.logInMiddwre,UserController.update);
module.exports = router;